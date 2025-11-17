# CLI Init Setup - Implementation Guide

This document extracts the UI/CLI initialization setup patterns from sonarflow for use in other CLI projects.

## Table of Contents
1. [Dependencies](#dependencies)
2. [Core Features](#core-features)
3. [Implementation Structure](#implementation-structure)
4. [Code Examples](#code-examples)
5. [Best Practices](#best-practices)

---

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "@inquirer/prompts": "^7.10.1",  // Interactive CLI prompts
    "chalk": "^5.6.2",                // Terminal colors
    "commander": "^14.0.2",           // CLI command framework
    "figlet": "^1.9.4",               // ASCII art banners
    "fs-extra": "^11.3.2",            // Enhanced file operations
    "gradient-string": "^3.0.0",      // Gradient text effects
    "ora": "^9.0.0"                   // Loading spinners
  }
}
```

### Installation

```bash
bun add @inquirer/prompts chalk commander figlet fs-extra gradient-string ora
```

---

## Core Features

### 1. **Animated Banner**
- ASCII art using `figlet`
- Gradient text animation
- Version display
- Branding message

### 2. **Interactive Prompts**
- Text input with defaults
- Select/multi-select menus
- Input validation
- Conditional prompts based on previous answers

### 3. **Smart Defaults Detection**
- Read from `package.json`
- Detect from file system (e.g., `.cursor`, `.vscode` directories)
- Parse existing configuration files
- Derive from current working directory

### 4. **Progress Indicators**
- Spinners for async operations
- Success/fail messages
- Color-coded feedback

### 5. **File Operations**
- Generate configuration files
- Update existing files (e.g., `package.json`)
- Create template-based files
- Ensure directory structure exists

### 6. **Error Handling**
- Graceful SIGINT (Ctrl+C) handling
- User-friendly error messages
- Non-blocking optional steps

---

## Implementation Structure

### File Organization

```
src/
  ├── cli.ts          # Main CLI entry point (commander setup)
  └── init.ts         # Init command implementation
```

### CLI Entry Point Pattern

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
program.name("your-cli").description("CLI description").version("1.0.0");

program
  .command("init")
  .description("Initialize configuration")
  .action(() => {
    runNodeScript("./init.js", process.argv.slice(3));
  });

program.parse(process.argv);
```

---

## Code Examples

### 1. Animated Banner with Gradient

```typescript
import figlet from "figlet";
import chalk from "chalk";
import gradient from "gradient-string";

const colors = ["#A4A5A7", "#C74600", "#EB640A", "#F2A65D"];
const dynamicGradient = gradient(colors);

const runBanner = async (): Promise<void> => {
  return new Promise((resolve) => {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const version = packageJson.version;

    figlet.text(
      "YourAppName",
      {
        font: "Slant",
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 80,
      },
      (err, data) => {
        if (err) {
          console.error(chalk.red(`❌ Figlet error: ${err.message}`));
          return;
        }

        const lines = data?.split("\n") ?? [];
        let i = 0;
        const interval = setInterval(() => {
          const shifted = [...colors.slice(i), ...colors.slice(0, i)];
          const dynamicGradient = gradient(shifted);

          console.clear();
          console.log(chalk.bold(dynamicGradient.multiline(lines.join("\n"))));
          console.log(chalk.bold(dynamicGradient.multiline(`v${version}\n`)));
          console.log(dynamicGradient("Your branding message"));

          i = (i + 1) % colors.length;
        }, 150);

        setTimeout(() => {
          clearInterval(interval);
          console.log("\n");
          resolve();
        }, 4000);
      }
    );
  });
};
```

### 2. Welcome Message with Gradient

```typescript
import gradient from "gradient-string";

const colors = ["#A4A5A7", "#C74600", "#EB640A", "#F2A65D"];
const dynamicGradient = gradient(colors);

console.log(dynamicGradient("Welcome to your CLI setup!\n"));
```

### 3. Interactive Prompts with Validation

```typescript
import { input, select } from "@inquirer/prompts";

// Text input with default and validation
const repoName = await input({
  message: "Repository name?",
  default: defaultRepoName,
  validate: (val: string) => {
    const trimmed = (val ?? "").trim();
    return trimmed ? true : "Repository name is required";
  },
});

// Select menu with choices
const gitProvider = await select<"github" | "bitbucket">({
  message: "Git provider:",
  choices: [
    { name: "github", value: "github" },
    { name: "bitbucket", value: "bitbucket" },
  ],
  default: defaultGitProvider,
});

// Conditional validation
const organization = await input({
  message: "Repository organization:",
  default: defaultOrganization ?? "",
  validate: (val: string) => {
    const trimmed = (val ?? "").trim();
    if (gitProvider === "bitbucket" || repositoryVisibility === "private") {
      return trimmed ? true : "Organization is required for Bitbucket or private repositories";
    }
    return true;
  },
});
```

### 4. Smart Defaults Detection

```typescript
import fs from "fs-extra";
import path from "node:path";

// Read package.json for defaults
const pkgPath = path.join(process.cwd(), "package.json");
let pkg: PackageJson = {};
try {
  if (await fs.pathExists(pkgPath)) {
    pkg = (await fs.readJson(pkgPath)) as PackageJson;
  }
} catch (error) {
  console.warn(chalk.yellow(`Warning: could not read package.json: ${error.message}`));
}

const defaultRepoName =
  typeof pkg.name === "string" && pkg.name.trim()
    ? pkg.name.trim()
    : path.basename(process.cwd());

// Detect from file system
const autoDetectEditor = () => {
  if (fs.pathExistsSync(path.join(process.cwd(), ".cursor"))) {
    return "cursor";
  }
  if (fs.pathExistsSync(path.join(process.cwd(), ".vscode"))) {
    return "copilot (vscode)";
  }
  return "other";
};

// Detect from existing config files
const autoDetectConfig = () => {
  const configPath = path.join(process.cwd(), ".existing-config.json");
  if (fs.pathExistsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      mode: config.mode || "standard",
      projectKey: config.projectKey || "",
    };
  }
  return { mode: "standard", projectKey: "" };
};
```

### 5. Spinners for Async Operations

```typescript
import ora from "ora";

// Writing configuration file
const configSpinner = ora({
  text: "Writing configuration…",
  color: "yellow",
}).start();

try {
  const configPath = path.join(process.cwd(), ".config.json");
  await fs.writeJson(configPath, config, { spaces: 2 });
  configSpinner.succeed(`Configuration saved to ${path.relative(process.cwd(), configPath)}`);
} catch (error) {
  configSpinner.fail("Failed to write configuration");
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}

// Updating package.json
const scriptsSpinner = ora({
  text: "Updating package.json scripts…",
  color: "yellow",
}).start();

try {
  const existingPkg = (await fs.pathExists(pkgPath))
    ? ((await fs.readJson(pkgPath)) as PackageJson)
    : {};
  if (!existingPkg.scripts) existingPkg.scripts = {};
  existingPkg.scripts["your:command"] = "npx your-cli command";
  await fs.writeJson(pkgPath, existingPkg, { spaces: 2 });
  scriptsSpinner.succeed("package.json scripts updated");
} catch (error) {
  scriptsSpinner.fail("Failed to update package.json");
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
```

### 6. Template File Generation

```typescript
import fs from "fs-extra";
import path from "node:path";

const ruleSpinner = ora({
  text: "Creating template file…",
  color: "yellow",
}).start();

try {
  // Resolve template based on user selection
  const templateFilename = `template-${flavor}.md`;
  const templatePath = path.join(__dirname, "../src/templates/", templateFilename);
  
  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template not found at ${templatePath}`);
  }
  
  const templateContent = await fs.readFile(templatePath, "utf8");
  const targetPath = path.join(process.cwd(), answers.targetPath);
  
  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, templateContent, "utf8");
  
  ruleSpinner.succeed(`Template created at ${path.relative(process.cwd(), targetPath)}`);
} catch (error) {
  ruleSpinner.fail("Failed to create template file");
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
```

### 7. Graceful Error Handling (SIGINT/Ctrl+C)

```typescript
let answers: InitAnswers;
try {
  const repoName = await input({
    message: "Repository name?",
    default: defaultRepoName,
  });
  // ... more prompts
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
        "👋 Setup cancelled\nThanks for trying your CLI!\nSee you next time ✨"
      )
    );
    process.exit(0);
  }
  // Re-throw other errors
  throw error;
}
```

### 8. Configuration File with Schema

```typescript
// Generate config with JSON schema reference
const config: Config & { $schema?: string } = {
  $schema: `https://raw.githubusercontent.com/yourorg/your-cli/v${version}/schemas/config.schema.json`,
  repoName: answers.repoName,
  gitProvider: answers.gitProvider,
  // ... other config properties
};

const configPath = path.join(process.cwd(), ".your-cli.json");
await fs.writeJson(configPath, config, { spaces: 2 });
```

### 9. Editor Configuration (VS Code/Cursor)

```typescript
const editorSpinner = ora({
  text: "Configuring editor settings…",
  color: "yellow",
}).start();

try {
  const vscodeDir = path.join(process.cwd(), ".vscode");
  const settingsPath = path.join(vscodeDir, "settings.json");
  await fs.ensureDir(vscodeDir);

  const settings: Record<string, unknown> = (await fs.pathExists(settingsPath))
    ? ((await fs.readJson(settingsPath)) as Record<string, unknown>)
    : {};

  // Configure icon theme
  settings["workbench.iconTheme"] = "material-icon-theme";

  // Merge file associations
  const associationsKey = "material-icon-theme.files.associations";
  const existingAssociations =
    typeof settings[associationsKey] === "object" && settings[associationsKey] !== null
      ? (settings[associationsKey] as Record<string, string>)
      : {};
  settings[associationsKey] = {
    ...existingAssociations,
    ".your-config.json": "your-icon-name",
  };

  await fs.writeJson(settingsPath, settings, { spaces: 2 });
  editorSpinner.succeed("Editor settings configured\n\n");
} catch (error) {
  editorSpinner.fail("Failed to configure editor settings");
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  // Do not exit: optional step
}
```

### 10. Complete Init Function Structure

```typescript
const runInit = async (): Promise<void> => {
  // 1. Welcome message
  console.log(dynamicGradient("Welcome to your CLI setup!\n"));

  // 2. Load defaults
  const defaults = await loadDefaults();

  // 3. Collect user input
  let answers: InitAnswers;
  try {
    answers = await collectAnswers(defaults);
  } catch (error) {
    handleGracefulExit(error);
    throw error;
  }

  // 4. Write configuration file
  await writeConfig(answers);

  // 5. Update package.json
  await updatePackageJson(answers);

  // 6. Create template files
  await createTemplateFiles(answers);

  // 7. Configure editor (optional)
  await configureEditor(answers);

  // 8. Success message
  console.log(dynamicGradient("✅ Setup complete."));
};
```

---

## Best Practices

### 1. **User Experience**
- ✅ Always provide sensible defaults
- ✅ Show progress with spinners
- ✅ Use colors for feedback (green=success, red=error, yellow=warning)
- ✅ Validate inputs immediately
- ✅ Handle Ctrl+C gracefully

### 2. **Error Handling**
- ✅ Catch and handle SIGINT separately
- ✅ Provide clear error messages
- ✅ Don't exit on optional steps (e.g., editor config)
- ✅ Exit with appropriate codes (0=success, 1=error)

### 3. **File Operations**
- ✅ Use `fs-extra` for enhanced operations
- ✅ Always ensure directories exist before writing files
- ✅ Preserve existing file content when merging
- ✅ Use relative paths in success messages

### 4. **Defaults Detection**
- ✅ Read from `package.json` when available
- ✅ Detect from file system structure
- ✅ Parse existing configuration files
- ✅ Fall back to current directory name

### 5. **Validation**
- ✅ Validate required fields
- ✅ Use conditional validation based on previous answers
- ✅ Provide helpful error messages
- ✅ Trim whitespace from inputs

### 6. **Code Organization**
- ✅ Separate banner from init logic
- ✅ Extract default detection functions
- ✅ Use TypeScript interfaces for type safety
- ✅ Keep functions focused and testable

### 7. **Visual Polish**
- ✅ Use gradients for branding
- ✅ Animate banners (optional)
- ✅ Consistent color scheme
- ✅ Clear success/error indicators

---

## Complete Example: Minimal Init Setup

```typescript
#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import figlet from "figlet";
import fs from "fs-extra";
import gradient from "gradient-string";
import ora from "ora";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = ["#A4A5A7", "#C74600", "#EB640A", "#F2A65D"];
const dynamicGradient = gradient(colors);

interface InitAnswers {
  projectName: string;
  framework: "react" | "vue" | "svelte";
}

const runBanner = async (): Promise<void> => {
  return new Promise((resolve) => {
    figlet.text("MyCLI", { font: "Slant" }, (err, data) => {
      if (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        return resolve();
      }
      console.log(chalk.bold(dynamicGradient.multiline(data || "")));
      console.log(dynamicGradient("Welcome to MyCLI setup!\n"));
      setTimeout(resolve, 2000);
    });
  });
};

const runInit = async (): Promise<void> => {
  console.log(dynamicGradient("Welcome to MyCLI setup!\n"));

  let answers: InitAnswers;
  try {
    const projectName = await input({
      message: "Project name?",
      default: path.basename(process.cwd()),
    });

    const framework = await select<"react" | "vue" | "svelte">({
      message: "Framework:",
      choices: [
        { name: "React", value: "react" },
        { name: "Vue", value: "vue" },
        { name: "Svelte", value: "svelte" },
      ],
    });

    answers = { projectName, framework };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (("name" in error && error.name === "ExitPromptError") ||
        ("message" in error && typeof error.message === "string" && error.message.includes("SIGINT")))
    ) {
      console.log("\n");
      console.log(dynamicGradient.multiline("👋 Setup cancelled\nSee you next time ✨"));
      process.exit(0);
    }
    throw error;
  }

  const spinner = ora({ text: "Creating configuration…", color: "yellow" }).start();
  try {
    const config = {
      projectName: answers.projectName,
      framework: answers.framework,
    };
    const configPath = path.join(process.cwd(), ".mycli.json");
    await fs.writeJson(configPath, config, { spaces: 2 });
    spinner.succeed(`Configuration saved to ${path.relative(process.cwd(), configPath)}`);
  } catch (error) {
    spinner.fail("Failed to write configuration");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  console.log(dynamicGradient("✅ Setup complete."));
};

await runBanner();
await runInit().catch((error) => {
  console.error(chalk.red("\n❌ An unexpected error occurred:"));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
```

---

## Summary Checklist

When implementing a CLI init setup, ensure you have:

- [ ] Animated banner with figlet and gradient
- [ ] Interactive prompts using @inquirer/prompts
- [ ] Smart defaults detection
- [ ] Input validation
- [ ] Progress spinners for async operations
- [ ] Configuration file generation
- [ ] Package.json script updates (if needed)
- [ ] Template file generation (if needed)
- [ ] Graceful error handling (SIGINT)
- [ ] Color-coded feedback (chalk)
- [ ] Success/error messages
- [ ] TypeScript interfaces for type safety
- [ ] ESM-compatible path handling

---

This guide provides all the essential patterns and code examples needed to implement a polished CLI initialization experience similar to sonarflow.

