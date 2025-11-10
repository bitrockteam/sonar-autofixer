#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import figlet from "figlet";
import fs from "fs-extra";
import gradient from "gradient-string";
import ora from "ora";

const colors = ["#A4A5A7", "#C74600", "#EB640A", "#F2A65D"];
const dynamicGradient = gradient(colors);
// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PackageJson {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  repository?: {
    url?: string;
  };
  [key: string]: unknown;
}

interface InitAnswers {
  repoName: string;
  gitProvider: "github" | "bitbucket";
  repositoryVisibility: "private" | "public";
  gitOrganization?: string;

  sonarOrganization?: string;
  sonarProjectKey: string;
  sonarMode: "standard" | "custom";
  sonarBaseUrl?: string;

  aiEditor: "cursor" | "copilot (vscode)" | "windsurf" | "other";
  rulesFlavor: "safe" | "vibe-coder" | "yolo";
  rulePath: string;
}

interface Config {
  repoName: string;
  gitProvider: "github" | "bitbucket";
  repositoryVisibility: "private" | "public";
  gitOrganization?: string;

  sonarOrganization?: string;
  sonarProjectKey: string;
  sonarMode: "standard" | "custom";
  sonarBaseUrl?: string;
  publicSonar?: boolean;

  aiEditor: "cursor" | "copilot (vscode)" | "windsurf" | "other";
  rulesFlavor: "safe" | "vibe-coder" | "yolo";
  rulePath: string;
}

const runInit = async (): Promise<void> => {
  console.log(dynamicGradient("Welcome to sonarflow setup!\n"));

  // Load sonarflow package.json to get version for schema URL
  const sonarflowPackageJsonPath = path.join(__dirname, "..", "package.json");
  const sonarflowPackageJson = (await fs.readJson(sonarflowPackageJsonPath)) as {
    version: string;
  };
  const schemaVersion = sonarflowPackageJson.version;
  const schemaUrl = `https://raw.githubusercontent.com/bitrockteam/sonarflow/v${schemaVersion}/schemas/sonarflowrc.schema.json`;

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
  const defaultGitProvider = pkg.repository?.url?.includes("bitbucket") ? "bitbucket" : "github";
  const defaultVisibility = pkg.private === true ? "private" : "public";
  const defaultGitOrganization = defaultRepoName.includes("@")
    ? defaultRepoName.split("/")[0]
    : undefined;

  const autoDetectAiEditor = () => {
    if (fs.pathExistsSync(path.join(process.cwd(), ".cursor"))) {
      return "cursor";
    }
    if (fs.pathExistsSync(path.join(process.cwd(), ".vscode"))) {
      return "copilot (vscode)";
    }
    if (fs.pathExistsSync(path.join(process.cwd(), ".windsurf"))) {
      return "windsurf";
    }
    return "other";
  };
  const defaultAiEditor = autoDetectAiEditor();

  const autoDetectSonarModeAndProjectKey = () => {
    const connectedModePath = path.join(process.cwd(), ".sonarlint/connectedMode.json");
    if (fs.pathExistsSync(connectedModePath)) {
      const connectedMode = JSON.parse(fs.readFileSync(connectedModePath as string, "utf8"));
      return {
        sonarMode: connectedMode.sonarQubeUri ? "custom" : "standard",
        sonarQubeUri: connectedMode.sonarQubeUri,
        sonarProjectKey: connectedMode.projectKey,
      };
    }
    return {
      sonarMode: "custom",
      sonarQubeUri: undefined,
      sonarProjectKey: "",
    };
  };
  const {
    sonarMode: defaultSonarMode,
    sonarProjectKey: defaultSonarProjectKey,
    sonarQubeUri: defaultSonarQubeUri,
  } = autoDetectSonarModeAndProjectKey();

  const defaultSonarOrganization = defaultRepoName.includes("@")
    ? defaultRepoName.split("/")[0]
    : undefined;

  const getDefaultRulePath = (
    editor: "cursor" | "copilot (vscode)" | "windsurf" | "other"
  ): string => {
    if (editor === "cursor") {
      return ".cursor/rules/sonarflow-autofix.mdc";
    }
    if (editor === "copilot (vscode)") {
      return ".vscode/sonarflow-autofix.md";
    }
    if (editor === "windsurf") {
      return ".windsurf/rules/sonarflow-autofix.mdc";
    }
    return ".rules/sonarflow-autofix.md";
  };

  let answers: InitAnswers;
  try {
    const repoName = await input({
      message: "Repository name?",
      default: defaultRepoName,
    });

    const gitProvider = await select<"github" | "bitbucket">({
      message: "Git provider:",
      choices: [
        { name: "github", value: "github" },
        { name: "bitbucket", value: "bitbucket" },
      ],
      default: defaultGitProvider,
    });

    const repositoryVisibility = await select<"private" | "public">({
      message: "Repository visibility:",
      choices: [
        { name: "private", value: "private" },
        { name: "public", value: "public" },
      ],
      default: defaultVisibility as "private" | "public",
    });

    let gitOrganization = await input({
      message: "Repository organization:",
      default: defaultGitOrganization ?? "",
      validate: (val: string) => {
        const trimmed = (val ?? "").trim();
        if (gitProvider === "bitbucket" || repositoryVisibility === "private") {
          return trimmed ? true : "Organization is required for Bitbucket or private repositories";
        }
        return true;
      },
    });
    gitOrganization = gitOrganization.trim();

    const aiEditor = await select<"cursor" | "copilot (vscode)" | "windsurf" | "other">({
      message: "AI editor:",
      choices: [
        { name: "cursor", value: "cursor" },
        { name: "copilot (vscode)", value: "copilot (vscode)" },
        { name: "windsurf", value: "windsurf" },
        { name: "other", value: "other" },
      ],
      default: defaultAiEditor,
    });

    const sonarMode = await select<"standard" | "custom">({
      message: "Sonar mode:",
      choices: [
        { name: "standard (SonarCloud)", value: "standard" },
        { name: "custom (self-hosted SonarQube)", value: "custom" },
      ],
      default: defaultSonarMode,
    });

    let sonarOrganization: string | undefined = await input({
      message: "Sonar organization (required for standard mode):",
      default: defaultSonarOrganization ?? "",
      validate: (val: string) => {
        const trimmed = (val ?? "").trim();
        if (sonarMode === "standard") {
          return trimmed ? true : "Sonar organization is required in standard mode";
        }
        return true;
      },
    });
    sonarOrganization = sonarOrganization.trim() || undefined;

    const sonarProjectKey = await input({
      message: "Sonar project key (project name):",
      default: (() => {
        if (defaultSonarProjectKey) return defaultSonarProjectKey;
        const parts = defaultRepoName.split("/");
        const base = parts[parts.length - 1] || defaultRepoName;
        return base;
      })(),
      validate: (val: string) => {
        const value = (val ?? "").trim();
        return value ? true : "Project key is required";
      },
    });

    let sonarBaseUrl: string = defaultSonarQubeUri ?? "";
    if (sonarMode === "custom") {
      sonarBaseUrl = await input({
        message: "Sonar URL (base, e.g., https://sonar.mycompany.com):",
        default: defaultSonarQubeUri,
        validate: (val: string) => {
          const trimmed = (val ?? "").trim();
          return /^https?:\/\//.test(trimmed)
            ? true
            : "Provide a valid http(s) URL for custom mode";
        },
      });
      sonarBaseUrl = sonarBaseUrl.trim();
    }

    const rulesFlavor = await select<"safe" | "vibe-coder" | "yolo">({
      message: "Rules flavor:",
      choices: [
        { name: "safe", value: "safe" },
        { name: "vibe-coder", value: "vibe-coder" },
        { name: "yolo", value: "yolo" },
      ],
      default: "safe",
    });

    const defaultRulePath = getDefaultRulePath(aiEditor);
    const rulePath = await input({
      message: "Rule path:",
      default: defaultRulePath,
      validate: (val: string) => {
        const trimmed = (val ?? "").trim();
        return trimmed ? true : "Rule path is required";
      },
    });

    answers = {
      repoName,
      gitProvider,
      repositoryVisibility,
      gitOrganization,
      aiEditor,
      sonarOrganization,
      sonarProjectKey,
      sonarMode,
      sonarBaseUrl,
      rulesFlavor,
      rulePath: rulePath.trim(),
    };
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
          "👋 Setup cancelled\nThanks for trying sonarflow!\nSee you next time ✨"
        )
      );
      process.exit(0);
    }
    // Re-throw other errors
    throw error;
  }

  // 1) Write configuration file .sonarflowrc.json
  const config: Config & { $schema?: string } = {
    $schema: schemaUrl,
    repoName: answers.repoName,
    gitProvider: answers.gitProvider,
    repositoryVisibility: answers.repositoryVisibility,
    gitOrganization: answers.gitOrganization?.trim() || undefined,

    // sonar
    sonarOrganization: answers.sonarOrganization,
    sonarProjectKey: answers.sonarProjectKey,
    sonarMode: answers.sonarMode,
    sonarBaseUrl: answers.sonarBaseUrl,
    publicSonar: false,

    // automation
    aiEditor: answers.aiEditor,
    rulesFlavor: answers.rulesFlavor,
    rulePath: answers.rulePath,
  };

  const configSpinner = ora({
    text: "Writing configuration…",
    color: "yellow",
  }).start();
  try {
    const configPath = path.join(process.cwd(), ".sonarflowrc.json");
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
    existingPkg.scripts["sonar:fetch"] = "npx @bitrockteam/sonarflow fetch";
    await fs.writeJson(pkgPath, existingPkg, { spaces: 2 });
    scriptsSpinner.succeed("package.json scripts updated");
  } catch (error) {
    scriptsSpinner.fail("Failed to update package.json");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 3) Create rule file based on AI editor selection and rules flavor
  const ruleSpinner = ora({
    text: "Creating AI editor rule…",
    color: "yellow",
  }).start();
  try {
    // Resolve template by rules flavor
    const flavor = answers.rulesFlavor;
    const templateFilename =
      flavor === "safe"
        ? "rule-safe.md"
        : flavor === "yolo"
          ? "rule-yolo.md"
          : "rule-vibe-coder.md";
    const templateRulePath = path.join(__dirname, "../src/templates/", templateFilename);
    if (!(await fs.pathExists(templateRulePath))) {
      throw new Error(`Template rule not found at ${templateRulePath}`);
    }
    const ruleContent = await fs.readFile(templateRulePath, "utf8");

    const targetRulePath = path.join(process.cwd(), answers.rulePath);

    await fs.ensureDir(path.dirname(targetRulePath));
    await fs.writeFile(targetRulePath, ruleContent, "utf8");
    ruleSpinner.succeed(`Rule created at ${path.relative(process.cwd(), targetRulePath)}`);
  } catch (error) {
    ruleSpinner.fail("Failed to create rule file");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 4) Configure VS Code/Cursor icon theme and filename association
  const editorSpinner = ora({
    text: "Configuring editor icon theme…",
    color: "yellow",
  }).start();
  try {
    const vscodeDir = path.join(process.cwd(), ".vscode");
    const settingsPath = path.join(vscodeDir, "settings.json");
    await fs.ensureDir(vscodeDir);

    const settings: Record<string, unknown> = (await fs.pathExists(settingsPath))
      ? ((await fs.readJson(settingsPath)) as Record<string, unknown>)
      : {};

    // Ensure Material Icon Theme is the active file icon theme
    settings["workbench.iconTheme"] = "material-icon-theme";

    // Merge file associations for Material Icon Theme
    const associationsKey = "material-icon-theme.files.associations";
    const existingAssociations =
      typeof settings[associationsKey] === "object" && settings[associationsKey] !== null
        ? (settings[associationsKey] as Record<string, string>)
        : {};
    settings[associationsKey] = {
      ...existingAssociations,
      ".sonarflowrc.json": "sonarcloud",
    };

    await fs.writeJson(settingsPath, settings, { spaces: 2 });
    editorSpinner.succeed("Editor icon theme configured\n\n");

    // Helpful note for users who don't have the theme installed
    console.log(
      chalk(
        "Tip: Install the 'Material Icon Theme' extension for icons to apply in VS Code/Cursor.\n"
      )
    );
  } catch (error) {
    editorSpinner.fail("Failed to configure editor icon theme");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    // Do not exit: optional step
  }

  console.log(dynamicGradient("✅ Setup complete."));
};

const runBanner = async (): Promise<void> => {
  return new Promise((resolve) => {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const version = packageJson.version;

    figlet.text(
      "Sonarflow",
      {
        // | "Standard"
        // | "Big"
        // | "Digital"
        // | "Slant"
        font: "Slant",
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 80,
      },
      (err, data) => {
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`❌ Figlet error: ${msg}`));
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
          console.log(chalk.bold(dynamicGradient.multiline(`v${version}\n`)));
          console.log(dynamicGradient("⚡@Bitrock - Empowering modern engineering ⚡"));

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
        "👋 Setup cancelled\nThanks for trying sonarflow!\nSee you next time ✨"
      )
    );
    process.exit(0);
  }
  // For other errors, exit with error code
  console.error(chalk.red("\n❌ An unexpected error occurred:"));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
