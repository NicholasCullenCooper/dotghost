import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { error } from "./output.js";

interface PackageJson {
  version: string;
}

const PACKAGE_JSON_URL = new URL("../package.json", import.meta.url);

export const IS_WINDOWS = os.platform() === "win32";
export const PKG = JSON.parse(stripBom(fs.readFileSync(fileURLToPath(PACKAGE_JSON_URL), "utf-8"))) as PackageJson;
export const APP_ROOT = path.dirname(fileURLToPath(PACKAGE_JSON_URL));
export const REGISTRY_DIR = path.join(os.homedir(), ".dotghost");
export const REGISTRY_IGNORE_FILE = ".dotghostignore";
export const REGISTRY_PROFILES_FILE = "dotghost.profiles.json";
export const STASH_DIR_NAME = ".dotghost-stash";
export const STASH_MANIFEST = "manifest.json";
export const GIT_DIR = path.resolve(".git");
export const GIT_EXCLUDE_FILE = path.join(GIT_DIR, "info", "exclude");
export const MANAGED_COMMENT = "# dotghost-managed";

const REGISTRY_NOISE_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

/** Strip UTF-8 BOM if present. */
export function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
}

/**
 * Normalize a filesystem path for reliable comparison.
 * Strips Windows junction `\\?\` prefix, resolves to absolute, and
 * lowercases on Windows (case-insensitive filesystem).
 */
export function normalizeFsPath(p: string): string {
  let cleaned = p.replace(/^\\\\\?\\/, "");
  cleaned = path.resolve(cleaned);
  return IS_WINDOWS ? cleaned.toLowerCase() : cleaned;
}

/** Check whether two filesystem paths point to the same location. */
export function pathsEqual(a: string, b: string): boolean {
  return normalizeFsPath(a) === normalizeFsPath(b);
}

/** Check whether `child` is inside (or equal to) the `parent` directory. */
export function pathStartsWith(child: string, parent: string): boolean {
  const nc = normalizeFsPath(child);
  const np = normalizeFsPath(parent);
  return nc === np || nc.startsWith(np + path.sep) || nc.startsWith(np + "/");
}

/** Read a UTF-8 text file, stripping BOM if present. */
export function readTextFile(filePath: string): string {
  return stripBom(fs.readFileSync(filePath, "utf-8"));
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function requireGitRepo(): void {
  if (!fs.existsSync(GIT_DIR) || !fs.statSync(GIT_DIR).isDirectory()) {
    error("Must be run at the root of a Git repository.");
    process.exit(1);
  }
}

export function requireRegistry(): void {
  if (!fs.existsSync(REGISTRY_DIR)) {
    error("Global registry does not exist. Run `dotghost init` first.");
    process.exit(1);
  }
}

export function normalizeRegistryPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\/$/, "");
}

export function registryEntries(dir = REGISTRY_DIR, prefix = ""): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir)) {
    if (
      entry === ".git"
      || entry === REGISTRY_IGNORE_FILE
      || entry === REGISTRY_PROFILES_FILE
      || REGISTRY_NOISE_FILES.has(entry)
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry);
    const relativePath = normalizeRegistryPath(prefix ? path.join(prefix, entry) : entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...registryEntries(fullPath, relativePath));
    } else {
      results.push(relativePath);
    }
  }

  return results;
}

export function gitCmd(args: string[], cwd = REGISTRY_DIR): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function cloneRegistry(url: string): void {
  execFileSync("git", ["clone", url, REGISTRY_DIR], { stdio: "inherit" });
}

export function execDiff(target: string, source: string): string {
  if (IS_WINDOWS) {
    // `diff` is not available on Windows by default; use `git diff --no-index`.
    try {
      return execFileSync("git", ["diff", "--no-index", "--", target, source], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (cause) {
      // git diff --no-index exits 1 when files differ, which is normal.
      const output = getErrorOutput(cause);
      if (output) {
        return output;
      }
      throw cause;
    }
  }

  return execFileSync("diff", ["--unified", target, source], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function isRegistryAGitRepo(): boolean {
  return fs.existsSync(path.join(REGISTRY_DIR, ".git"));
}

export function requireRegistryGit(): void {
  requireRegistry();
  if (!isRegistryAGitRepo()) {
    error("Registry is not a Git repository. Use `dotghost init <git-url>` to set one up.");
    process.exit(1);
  }
}

export function getErrorOutput(cause: unknown): string {
  if (typeof cause === "object" && cause !== null && "stdout" in cause) {
    const stdout = (cause as { stdout?: Buffer | string }).stdout;
    if (typeof stdout === "string") {
      return stdout;
    }
    if (stdout instanceof Buffer) {
      return stdout.toString("utf-8");
    }
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}