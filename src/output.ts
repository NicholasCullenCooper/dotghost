export const color = {
  green: (value: string): string => `\x1b[32m${value}\x1b[0m`,
  yellow: (value: string): string => `\x1b[33m${value}\x1b[0m`,
  red: (value: string): string => `\x1b[31m${value}\x1b[0m`,
  cyan: (value: string): string => `\x1b[36m${value}\x1b[0m`,
  bold: (value: string): string => `\x1b[1m${value}\x1b[0m`,
  dim: (value: string): string => `\x1b[2m${value}\x1b[0m`,
};

export function success(message: string): void {
  console.log(color.green(`✔ ${message}`));
}

export function warn(message: string): void {
  console.log(color.yellow(`⚠ ${message}`));
}

export function info(message: string): void {
  console.log(color.cyan(`ℹ ${message}`));
}

export function error(message: string): void {
  console.error(color.red(`✖ ${message}`));
}