import chalk from "chalk";

export const logger = {
  info: (message: string) => console.log(chalk.blue("info"), message),
  success: (message: string) => console.log(chalk.green("success"), message),
  warn: (message: string) => console.log(chalk.yellow("warn"), message),
  error: (message: string) => console.log(chalk.red("error"), message),
  log: (message: string) => console.log(message),
  blank: () => console.log(),
};

export const highlight = chalk.cyan;
export const dim = chalk.dim;
export const bold = chalk.bold;
