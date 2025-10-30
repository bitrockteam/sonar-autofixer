#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import figlet from "figlet";
import gradient from "gradient-string";

const colors = ["#A4A5A7", "#C74600", "#EB640A", "#F2A65D"];
const dynamicGradient = gradient(colors);
// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PackageJson {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

interface InitAnswers {
  repoName: string;
  sonarProjectKey: string;
  gitProvider: "github" | "bitbucket";
  gitOrganization?: string;
  repositoryVisibility: "private" | "public";
  publicSonar: boolean;
  outputPath: string;
  aiEditor: "cursor" | "copilot (vscode)" | "windsurf" | "other";
}

interface Config {
  repoName: string;
  sonarProjectKey: string;
  gitProvider: "github" | "bitbucket";
  gitOrganization?: string;
  repositoryVisibility: "private" | "public";
  publicSonar: boolean;
  outputPath: string;
  aiEditor: "cursor" | "copilot (vscode)" | "windsurf" | "other";
}

const runInit = async (): Promise<void> => {
  console.log(dynamicGradient("Welcome to sonar-autofixer setup!"));

  // Load package.json to derive sensible defaults
  const pkgPath = path.join(process.cwd(), "package.json");
  let pkg: PackageJson = {};
  try {
    if (await fs.pathExists(pkgPath)) {
      pkg = (await fs.readJson(pkgPath)) as PackageJson;
    }
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Warning: could not read package.json for defaults: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
  }

  const defaultRepoName =
    typeof pkg.name === "string" && pkg.name.trim()
      ? pkg.name.trim()
      : path.basename(process.cwd());
  const defaultVisibility = pkg.private === true ? "private" : "public";
  const defaultSonarProjectKey = defaultRepoName.includes("@")
    ? defaultRepoName
    : `@org/${defaultRepoName}`;

  let answers: InitAnswers;
  try {
    answers = await inquirer.prompt<InitAnswers>([
      {
        type: "input",
        name: "repoName",
        message: "Repo name?",
        default: defaultRepoName,
      },
      {
        type: "input",
        name: "sonarProjectKey",
        message: "Sonar project key (e.g., @org/repo)?",
        default: defaultSonarProjectKey,
        validate: (input: string) => {
          const isValid = /^@[^\n\/]+\/[^\n\/]+$/.test(input.trim());
          return isValid || "Use the format @org/repo";
        },
      },
      {
        type: "input",
        name: "gitOrganization",
        message: "Organization (optional, for Git provider):",
        default: "",
        filter: (input: string) => input.trim(),
      },
      {
        type: "list",
        name: "gitProvider",
        message: "Git provider:",
        choices: ["github", "bitbucket"],
        default: "github",
      },
      {
        type: "list",
        name: "repositoryVisibility",
        message: "Repository visibility:",
        choices: ["private", "public"],
        default: defaultVisibility,
      },
      {
        type: "confirm",
        name: "publicSonar",
        message: "Public sonar?",
        default: true, // Y/n
      },
      {
        type: "input",
        name: "outputPath",
        message: "Output path:",
        default: ".sonar/",
      },
      {
        type: "list",
        name: "aiEditor",
        message: "AI editor:",
        choices: ["cursor", "copilot (vscode)", "windsurf", "other"],
        default: "cursor",
      },
    ]);
  } catch (error) {
    // Handle graceful exit on SIGINT (Ctrl+C)
    if (
      error &&
      typeof error === "object" &&
      (("name" in error && error.name === "ExitPromptError") ||
        ("message" in error &&
          typeof error.message === "string" &&
          error.message.includes("SIGINT")))
    ) {
      console.log("\n");
      const exitGradient = dynamicGradient;
      console.log(
        exitGradient.multiline(
          "👋 Setup cancelled\nThanks for trying sonar-autofixer!\nSee you next time ✨"
        )
      );
      process.exit(0);
    }
    // Re-throw other errors
    throw error;
  }

  // 1) Write configuration file ./sonar/autofixer.config.json
  const config: Config = {
    repoName: answers.repoName,
    sonarProjectKey: answers.sonarProjectKey,
    gitProvider: answers.gitProvider,
    gitOrganization: answers.gitOrganization?.trim() || undefined,
    repositoryVisibility: answers.repositoryVisibility,
    publicSonar: answers.publicSonar,
    outputPath: answers.outputPath,
    aiEditor: answers.aiEditor,
  };

  const configSpinner = ora({
    text: "Writing configuration…",
    color: "yellow",
  }).start();
  try {
    const sonarDir = path.join(process.cwd(), ".sonar");
    await fs.ensureDir(sonarDir);
    const configPath = path.join(sonarDir, "autofixer.config.json");
    await fs.writeJson(configPath, config, { spaces: 2 });
    configSpinner.succeed(`Configuration saved to ${path.relative(process.cwd(), configPath)}`);
  } catch (error) {
    configSpinner.fail("Failed to write configuration");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 2) Update package.json scripts
  const scriptsSpinner = ora({
    text: "Updating package.json scripts…",
    color: "yellow",
  }).start();
  try {
    const existingPkg = (await fs.pathExists(pkgPath))
      ? ((await fs.readJson(pkgPath)) as PackageJson)
      : {};
    if (!existingPkg.scripts) existingPkg.scripts = {};
    existingPkg.scripts["sonar:scan"] = "npx @bitrockteam/sonar-autofixer scan";
    existingPkg.scripts["sonar:fetch"] = "npx @bitrockteam/sonar-autofixer fetch";
    await fs.writeJson(pkgPath, existingPkg, { spaces: 2 });
    scriptsSpinner.succeed("package.json scripts updated");
  } catch (error) {
    scriptsSpinner.fail("Failed to update package.json");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 3) Create rule file based on AI editor selection using src/templates/rule.md
  const ruleSpinner = ora({
    text: "Creating AI editor rule…",
    color: "yellow",
  }).start();
  try {
    // Go up one level from dist to src, then to templates
    const templateRulePath = path.join(__dirname, "../src/templates/rule.md");
    if (!(await fs.pathExists(templateRulePath))) {
      throw new Error(`Template rule not found at ${templateRulePath}`);
    }
    const ruleContent = await fs.readFile(templateRulePath, "utf8");

    const editor = answers.aiEditor;
    let targetRulePath: string;
    if (editor === "cursor") {
      targetRulePath = path.join(process.cwd(), ".cursor/rules/sonar-issue-fix.mdc");
    } else if (editor === "copilot (vscode)") {
      targetRulePath = path.join(process.cwd(), ".vscode/sonar-issue-fix.md");
    } else if (editor === "windsurf") {
      targetRulePath = path.join(process.cwd(), ".windsurf/rules/sonar-issue-fix.mdc");
    } else {
      targetRulePath = path.join(process.cwd(), ".rules/sonar-issue-fix.md");
    }

    await fs.ensureDir(path.dirname(targetRulePath));
    await fs.writeFile(targetRulePath, ruleContent, "utf8");
    ruleSpinner.succeed(`Rule created at ${path.relative(process.cwd(), targetRulePath)}`);
  } catch (error) {
    ruleSpinner.fail("Failed to create rule file");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  console.log(dynamicGradient("✅ Setup complete."));
};

const runBanner = async (): Promise<void> => {
  return new Promise((resolve) => {
    figlet.text(
      "Bitrock",
      {
        font: "ANSI Shadow",
        horizontalLayout: "default",
        verticalLayout: "default",
      },
      (err, data) => {
        if (err) {
          console.error("❌ Figlet error:", err);
          return;
        }

        const lines = data?.split("\n") ?? [];

        let i = 0;
        const interval = setInterval(() => {
          // Rotate gradient colors over time for smooth animation
          const shifted = [...colors.slice(i), ...colors.slice(0, i)];
          const dynamicGradient = gradient(shifted);

          console.clear();

          console.log(chalk.bold(dynamicGradient.multiline(lines.join("\n"))));
          console.log(dynamicGradient("⚡ Empowering modern engineering ⚡"));

          i = (i + 1) % colors.length;
        }, 150); // Adjust speed here (lower = faster)

        setTimeout(() => {
          clearInterval(interval);
          console.log("\n");
          resolve();
        }, 4000);
      }
    );
  });
};

await runBanner();

await runInit().catch((error) => {
  // Handle any unexpected errors
  if (
    error &&
    typeof error === "object" &&
    (("name" in error && error.name === "ExitPromptError") ||
      ("message" in error && typeof error.message === "string" && error.message.includes("SIGINT")))
  ) {
    // Already handled in runInit, but just in case
    console.log("\n");
    const exitGradient = dynamicGradient;
    console.log(
      exitGradient.multiline(
        "👋 Setup cancelled\nThanks for trying sonar-autofixer!\nSee you next time ✨"
      )
    );
    process.exit(0);
  }
  // For other errors, exit with error code
  console.error(chalk.red("\n❌ An unexpected error occurred:"));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
