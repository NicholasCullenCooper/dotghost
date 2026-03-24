import fs from "node:fs";
import path from "node:path";

import { normalizeRegistryPath, readTextFile, REGISTRY_DIR, REGISTRY_IGNORE_FILE } from "./runtime.js";

export interface MountSelection {
  forceAll: boolean;
  skipAll: boolean;
  includeIgnored: boolean;
  includePatterns: string[];
  excludePatterns: string[];
}

function hasGlobMagic(pattern: string): boolean {
  return /[*?[]/.test(pattern);
}

function globToRegExp(pattern: string): RegExp {
  let regex = "^";

  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];

    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          regex += "(?:.*/)?";
          index += 2;
        } else {
          regex += ".*";
          index++;
        }
      } else {
        regex += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      continue;
    }

    if (/[|\\{}()[\]^$+?.]/.test(char)) {
      regex += `\\${char}`;
      continue;
    }

    regex += char;
  }

  regex += "$";
  return new RegExp(regex);
}

export function createPathMatcher(pattern: string): (entry: string) => boolean {
  const normalized = normalizeRegistryPath(pattern);

  if (!normalized) {
    return () => false;
  }

  if (!hasGlobMagic(normalized)) {
    return (entry: string) => entry === normalized || entry.startsWith(`${normalized}/`);
  }

  const regex = globToRegExp(normalized);
  return (entry: string) => regex.test(entry);
}

export function readRegistryIgnorePatterns(): string[] {
  const ignorePath = path.join(REGISTRY_DIR, REGISTRY_IGNORE_FILE);

  if (!fs.existsSync(ignorePath)) {
    return [];
  }

  return readTextFile(ignorePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function filterRegistryEntries(entries: string[], includePatterns: string[], excludePatterns: string[]): string[] {
  const includeMatchers = includePatterns.map(createPathMatcher);
  const excludeMatchers = excludePatterns.map(createPathMatcher);

  return entries.filter((entry) => {
    const included = includeMatchers.length === 0 || includeMatchers.some((matches) => matches(entry));
    if (!included) {
      return false;
    }
    return !excludeMatchers.some((matches) => matches(entry));
  });
}

export function applyRegistryIgnore(entries: string[], ignorePatterns: string[]): string[] {
  if (ignorePatterns.length === 0) {
    return entries;
  }

  const ignoreMatchers = ignorePatterns.map(createPathMatcher);
  return entries.filter((entry) => !ignoreMatchers.some((matches) => matches(entry)));
}