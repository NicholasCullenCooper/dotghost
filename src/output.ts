import os from "node:os";

const isUnicodeSupported =
  os.platform() !== "win32"
  || Boolean(process.env.CI)
  || Boolean(process.env.WT_SESSION) // Windows Terminal
  || process.env.TERM_PROGRAM === "vscode"
  || process.env.TERM === "xterm-256color";

export const symbols = isUnicodeSupported
  ? { success: "\u2714", warn: "\u26A0", info: "\u2139", error: "\u2716", mounted: "\uD83D\uDFE2", unmounted: "\u26AA\uFE0F", stash: "\uD83D\uDCE6" }
  : { success: "+", warn: "!", info: "i", error: "x", mounted: "[+]", unmounted: "[ ]", stash: "[~]" };

export const color = {
  green: (value: string): string => `\x1b[32m${value}\x1b[0m`,
  yellow: (value: string): string => `\x1b[33m${value}\x1b[0m`,
  red: (value: string): string => `\x1b[31m${value}\x1b[0m`,
  cyan: (value: string): string => `\x1b[36m${value}\x1b[0m`,
  bold: (value: string): string => `\x1b[1m${value}\x1b[0m`,
  dim: (value: string): string => `\x1b[2m${value}\x1b[0m`,
};

export function success(message: string): void {
  console.log(color.green(`${symbols.success} ${message}`));
}

export function warn(message: string): void {
  console.log(color.yellow(`${symbols.warn} ${message}`));
}

export function info(message: string): void {
  console.log(color.cyan(`${symbols.info} ${message}`));
}

export function error(message: string): void {
  console.error(color.red(`${symbols.error} ${message}`));
}