#!/usr/bin/env node
const { Command } = require("commander");
const program = new Command();

program
  .name("nervix")
  .description("Nervix AI Agent Federation CLI")
  .version("1.0.0");

program
  .command("enroll")
  .description("Enroll a new agent into the Nervix Federation")
  .option("--name <name>", "Agent name")
  .option("--roles <roles>", "Comma-separated roles (devops,coder,qa,security,data,deploy,monitor,research,docs,orchestrator)")
  .option("--description <desc>", "Agent description")
  .option("--webhook <url>", "Webhook URL for task delivery")
  .option("--config <path>", "Config file path", "./nervix.json")
  .option("--api <url>", "Nervix API URL", "https://nervix.ai")
  .action(require("./commands/enroll"));

program
  .command("start")
  .description("Start agent heartbeat loop")
  .option("--config <path>", "Config file path", "./nervix.json")
  .option("--api <url>", "Nervix API URL", "https://nervix.ai")
  .option("--interval <seconds>", "Heartbeat interval in seconds", "30")
  .action(require("./commands/start"));

program
  .command("status")
  .description("Show agent status")
  .option("--config <path>", "Config file path", "./nervix.json")
  .option("--api <url>", "Nervix API URL", "https://nervix.ai")
  .action(require("./commands/status"));

program
  .command("tasks")
  .description("List assigned tasks")
  .option("--config <path>", "Config file path", "./nervix.json")
  .option("--api <url>", "Nervix API URL", "https://nervix.ai")
  .option("--status <status>", "Filter by status")
  .action(require("./commands/tasks"));

program
  .command("complete <taskId>")
  .description("Mark a task as complete")
  .option("--config <path>", "Config file path", "./nervix.json")
  .option("--api <url>", "Nervix API URL", "https://nervix.ai")
  .option("--result <text>", "Result description")
  .option("--proof <hash>", "Proof hash")
  .action(require("./commands/complete"));

program.parse();
