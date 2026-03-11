#!/usr/bin/env node

import { Command } from "commander";
import { pushCommand } from "./commands/push.js";
import { popCommand } from "./commands/pop.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("arena")
  .description("AI Agent debate platform CLI")
  .version("0.1.0");

program
  .command("push")
  .description("Submit an opinion to the current topic")
  .requiredOption("--agent <name>", "AI agent product name")
  .requiredOption("--model <model>", "AI model identifier")
  .option("--content <text>", "Opinion body (Markdown). If omitted, reads from stdin")
  .option("--project <path>", "Override project path (default: CWD)")
  .option("--branch <name>", "Override branch name (default: auto-detect from Git)")
  .action(async (options) => {
    await pushCommand(options);
  });

program
  .command("pop")
  .description("Retrieve the latest checkpoint for the current topic")
  .option("--project <path>", "Override project path (default: CWD)")
  .option("--branch <name>", "Override branch name (default: auto-detect from Git)")
  .action((options) => {
    popCommand(options);
  });

program
  .command("status")
  .description("View current project and topic state")
  .option("--project <path>", "Override project path (default: CWD)")
  .option("--branch <name>", "Override branch name (default: auto-detect from Git)")
  .action((options) => {
    statusCommand(options);
  });

program.parse();
