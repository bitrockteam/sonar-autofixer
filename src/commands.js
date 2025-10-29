#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name("create-mytool")
  .description("Scaffold a new project/config via mytool")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize configuration/project")
  .action(async () => {
    console.log(chalk.blue("Welcome to create-mytool!"));

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        default: "my-project",
      },
      {
        type: "list",
        name: "templateType",
        message: "Which template do you want?",
        choices: ["templateA", "templateB"],
      },
      {
        type: "confirm",
        name: "installDeps",
        message: "Install dependencies now?",
        default: true,
      },
    ]);

    const targetDir = path.join(process.cwd(), answers.projectName);
    const templateDir = path.join(
      __dirname,
      "./templates",
      answers.templateType
    );

    if (!fs.existsSync(templateDir)) {
      console.error(chalk.red(`Template ${answers.templateType} not found!`));
      process.exit(1);
    }

    const copySpinner = ora({
      text: "Copying files…",
      color: "yellow",
    }).start();
    try {
      await fs.copy(templateDir, targetDir);
      copySpinner.succeed("Files copied");
    } catch (error) {
      copySpinner.fail("Copy failed");
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }

    if (answers.installDeps) {
      const installSpinner = ora({
        text: "Installing dependencies…",
        color: "yellow",
      }).start();
      // Simulate install phase without actually running a child process
      await new Promise((resolve) => setTimeout(resolve, 800));
      installSpinner.succeed("Dependencies installed (simulation)");
    }

    console.log(chalk.green("✅ Done!"));
    console.log(`Next steps: cd ${answers.projectName} && ...`);
  });

program.parse(process.argv);
