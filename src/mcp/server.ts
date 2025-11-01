#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getRepoInfo } from "./tools/bitbucket.js";
import { getQualityGateStatus } from "./tools/sonar.js";

// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get package version
// Try multiple paths to support both development and production (published package)
const packageJsonPaths = [
  path.join(__dirname, "..", "..", "package.json"), // Development: dist/mcp/server.js -> package.json
  path.join(__dirname, "..", "..", "..", "package.json"), // Production: node_modules/@bitrockteam/sonarflow/dist/mcp/server.js -> package.json
];

let packageJson: { version: string; name?: string };
let version = "0.0.0";

for (const packageJsonPath of packageJsonPaths) {
  try {
    const content = readFileSync(packageJsonPath, "utf8");
    packageJson = JSON.parse(content);
    version = packageJson.version as string;
    break;
  } catch {
    // Continue to next path
  }
}

// Initialize MCP Server
const server = new McpServer(
  {
    name: "sonarflow-mcp",
    version,
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// Load prompt from file
// Works for both development and production:
// - Development: dist/mcp/server.js -> ../../src/prompts
// - Production: node_modules/@bitrockteam/sonarflow/dist/mcp/server.js -> ../../src/prompts
const loadPrompt = (name: string): string => {
  const promptPath = path.join(__dirname, "..", "..", "src", "prompts", `${name}.txt`);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    throw new Error(
      `Prompt file not found: ${name}.txt at ${promptPath}. ` +
        `This may indicate the package files are not properly installed.`
    );
  }
};

// Register Bitbucket tool
server.tool(
  "bitbucket.getRepoInfo",
  "Fetches repository metadata from Bitbucket REST API",
  {
    owner: z.string().describe("Repository owner/workspace name"),
    repo: z.string().describe("Repository name"),
    token: z
      .string()
      .optional()
      .describe("Optional Bitbucket app password token for authentication"),
    email: z
      .string()
      .optional()
      .describe("Optional Bitbucket email (required if token is provided)"),
  },
  async (args) => {
    try {
      const result = await getRepoInfo(args.owner, args.repo, args.token, args.email);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// Register SonarQube tool
server.tool(
  "sonar.getQualityGateStatus",
  "Fetches quality gate status from SonarQube API",
  {
    projectKey: z.string().describe("SonarQube project key"),
    sonarToken: z.string().optional().describe("Optional SonarQube authentication token"),
    sonarBaseUrl: z
      .string()
      .optional()
      .describe("Optional SonarQube base URL (defaults to https://sonarcloud.io/api)"),
  },
  async (args) => {
    try {
      const result = await getQualityGateStatus(
        args.projectKey,
        args.sonarToken,
        args.sonarBaseUrl
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// Register code review prompt
const codeReviewPromptContent = loadPrompt("code_review");
server.prompt(
  "code_review",
  "Expert code review prompt focused on code quality, bugs, and best practices",
  {
    code: z.string().describe("The code to review"),
  },
  async (args) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `${codeReviewPromptContent}\n\nCode to review:\n${args.code}`,
          },
        },
      ],
    };
  }
);

// Register security scan prompt
const securityScanPromptContent = loadPrompt("security_scan");
server.prompt(
  "security_scan",
  "Security expert prompt for scanning code for vulnerabilities and security issues",
  {
    code: z.string().describe("The code to scan for security issues"),
  },
  async (args) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `${securityScanPromptContent}\n\nCode to scan:\n${args.code}`,
          },
        },
      ],
    };
  }
);

// Start server with stdio transport
const transport = new StdioServerTransport();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

try {
  await server.connect(transport);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start MCP server: ${errorMessage}`);
  process.exit(1);
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

try {
  await server.connect(transport);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start MCP server: ${errorMessage}`);
  process.exit(1);
}
