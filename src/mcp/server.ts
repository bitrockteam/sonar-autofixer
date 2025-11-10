#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SonarIssueExtractor } from "../sonar/sonar-issue-extractor.js";
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

// Register sonar autofix prompt
const sonarAutofixPromptContent = loadPrompt("sonar_autofix");
server.prompt(
  "sonar_autofix",
  "Automatically fix SonarQube issues for the current branch using autofix rules",
  {
    workspacePath: z
      .string()
      .optional()
      .describe("Optional workspace path (defaults to current working directory)"),
    branch: z.string().optional().describe("Optional branch name (defaults to current git branch)"),
  },
  async (args) => {
    try {
      const workspacePath = args.workspacePath || process.cwd();
      const configPath = path.join(workspacePath, ".sonarflowrc.json");

      // Load configuration
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: .sonarflowrc.json at ${configPath}`);
      }

      const config = JSON.parse(readFileSync(configPath, "utf8")) as {
        repoName: string;
        gitOrganization: string;
        sonarProjectKey: string;
        sonarBaseUrl?: string;
        publicSonar?: boolean;
        gitProvider?: "github" | "bitbucket";
        sonarOrganization?: string;
        sonarMode?: "standard" | "custom";
        outputPath?: string;
        [key: string]: unknown;
      };

      // Get current branch
      let currentBranch = args.branch;
      if (!currentBranch) {
        try {
          currentBranch = execSync("git branch --show-current", {
            encoding: "utf8",
            cwd: workspacePath,
          }).trim();
        } catch {
          throw new Error("Could not determine current git branch");
        }
      }

      // Initialize SonarQube extractor and fetch issues
      const extractor = new SonarIssueExtractor();
      const issues = await extractor.fetchIssuesForBranch(currentBranch, config);

      // Read autofix rules file
      const autofixRulesPath = path.join(
        workspacePath,
        ".cursor",
        "rules",
        "sonarflow-autofix.mdc"
      );
      let autofixRules = "";
      if (existsSync(autofixRulesPath)) {
        autofixRules = readFileSync(autofixRulesPath, "utf-8");
      } else {
        autofixRules = `Warning: Autofix rules file not found at ${autofixRulesPath}. Please ensure the file exists.`;
      }

      // Combine everything in the prompt message
      const issuesJson = JSON.stringify(issues, null, 2);
      const promptText = `${sonarAutofixPromptContent}

## Autofix Rules:
${autofixRules}

## Current Branch:
${currentBranch}

## SonarQube Issues:
${issuesJson}

Please analyze the SonarQube issues above and apply fixes according to the autofix rules provided. Focus on fixing issues one by one, following the priority order and patterns specified in the rules.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Error setting up sonar autofix prompt: ${errorMessage}`,
            },
          },
        ],
        isError: true,
      };
    }
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
