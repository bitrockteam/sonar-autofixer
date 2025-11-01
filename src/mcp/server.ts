#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getRepoInfo } from "./tools/bitbucket.js";
import { getQualityGateStatus } from "./tools/sonar.js";

// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get package version
const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version as string;

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
	},
);

// Load prompt from file
// Prompts are in src/prompts and included in package files
// From dist/mcp/server.js, path is ../../src/prompts
const loadPrompt = (name: string): string => {
	const filePath = path.join(__dirname, "..", "..", "src", "prompts", `${name}.txt`);
	return readFileSync(filePath, "utf-8");
};

// Register Bitbucket tool
server.tool(
	"bitbucket.getRepoInfo",
	"Fetches repository metadata from Bitbucket REST API",
	{
		owner: z.string().describe("Repository owner/workspace name"),
		repo: z.string().describe("Repository name"),
		token: z.string().optional().describe("Optional Bitbucket app password token for authentication"),
		email: z.string().optional().describe("Optional Bitbucket email (required if token is provided)"),
	},
	async (args) => {
		const result = await getRepoInfo(args.owner, args.repo, args.token, args.email);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},
);

// Register SonarQube tool
server.tool(
	"sonar.getQualityGateStatus",
	"Fetches quality gate status from SonarQube API",
	{
		projectKey: z.string().describe("SonarQube project key"),
		sonarToken: z.string().optional().describe("Optional SonarQube authentication token"),
		sonarBaseUrl: z.string().optional().describe("Optional SonarQube base URL (defaults to https://sonarcloud.io/api)"),
	},
	async (args) => {
		const result = await getQualityGateStatus(args.projectKey, args.sonarToken, args.sonarBaseUrl);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	},
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
	},
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
	},
);

// Start server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);