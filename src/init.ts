#!/usr/bin/env node

import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";

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
  gitProvider: "github" | "bitbucket";
  repositoryVisibility: "private" | "public";
  publicSonar: boolean;
  outputPath: string;
  aiEditor: "cursor" | "copilot (vscode)" | "windsurf" | "other";
}

interface Config {
  repoName: string;
  gitProvider: "github" | "bitbucket";
  repositoryVisibility: "private" | "public";
  publicSonar: boolean;
  outputPath: string;
  aiEditor: "cursor" | "copilot (vscode)" | "windsurf" | "other";
}

const runInit = async (): Promise<void> => {
  console.log(chalk.blue("Welcome to sonar-autofixer setup!"));

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

  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: "input",
      name: "repoName",
      message: "Repo name?",
      default: defaultRepoName,
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

  // 1) Write configuration file ./sonar/autofixer.config.json
  const config: Config = {
    repoName: answers.repoName,
    gitProvider: answers.gitProvider,
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
    configSpinner.succeed(
      `Configuration saved to ${path.relative(process.cwd(), configPath)}`
    );
  } catch (error) {
    configSpinner.fail("Failed to write configuration");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
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
    existingPkg.scripts["sonar:scan"] = "npx davide97g:sonar-autofixer scan";
    existingPkg.scripts["sonar:fetch"] = "npx davide97g:sonar-autofixer fetch";
    await fs.writeJson(pkgPath, existingPkg, { spaces: 2 });
    scriptsSpinner.succeed("package.json scripts updated");
  } catch (error) {
    scriptsSpinner.fail("Failed to update package.json");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }

  // 3) Create rule file based on AI editor selection using src/templates/rule.md
  const ruleSpinner = ora({
    text: "Creating AI editor rule…",
    color: "yellow",
  }).start();
  try {
    const templateRulePath = path.join(__dirname, "./templates/rule.md");
    if (!(await fs.pathExists(templateRulePath))) {
      throw new Error(`Template rule not found at ${templateRulePath}`);
    }
    const ruleContent = await fs.readFile(templateRulePath, "utf8");

    const editor = answers.aiEditor;
    let targetRulePath: string;
    if (editor === "cursor") {
      targetRulePath = path.join(
        process.cwd(),
        ".cursor/rules/sonar-issue-fix.mdc"
      );
    } else if (editor === "copilot (vscode)") {
      targetRulePath = path.join(process.cwd(), ".vscode/sonar-issue-fix.md");
    } else if (editor === "windsurf") {
      targetRulePath = path.join(
        process.cwd(),
        ".windsurf/rules/sonar-issue-fix.mdc"
      );
    } else {
      targetRulePath = path.join(process.cwd(), "rules/sonar-issue-fix.md");
    }

    await fs.ensureDir(path.dirname(targetRulePath));
    await fs.writeFile(targetRulePath, ruleContent, "utf8");
    ruleSpinner.succeed(
      `Rule created at ${path.relative(process.cwd(), targetRulePath)}`
    );
  } catch (error) {
    ruleSpinner.fail("Failed to create rule file");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }

  console.log(chalk.green("✅ Setup complete."));
};

await runInit();
