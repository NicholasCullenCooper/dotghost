import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

import {
  ensureDir,
  GIT_DIR,
  GIT_EXCLUDE_FILE,
  MANAGED_COMMENT,
  normalizeRegistryPath,
  REGISTRY_DIR,
  STASH_DIR_NAME,
  STASH_MANIFEST,
} from "./runtime.js";

interface ManifestEntry {
  stashedAt: string;
  size: number;
}

type StashManifest = Record<string, ManifestEntry>;

export interface MountedRegistryLink {
  relativePath: string;
  fullPath: string;
  expectedSource: string;
  actualTarget: string;
  resolvedTarget: string;
}

export function readExclude(): string[] {
  ensureDir(path.join(GIT_DIR, "info"));
  if (!fs.existsSync(GIT_EXCLUDE_FILE)) {
    return [];
  }
  return fs.readFileSync(GIT_EXCLUDE_FILE, "utf-8").split("\n");
}

export function writeExclude(lines: string[]): void {
  const content = lines.join("\n");
  fs.writeFileSync(GIT_EXCLUDE_FILE, content.endsWith("\n") ? content : `${content}\n`);
}

export function addExclusion(filename: string): boolean {
  const lines = readExclude();
  if (lines.some((line) => line.trim() === filename)) {
    return false;
  }

  const needsNewline = lines.length > 0 && lines[lines.length - 1] !== "";
  if (needsNewline) {
    lines.push("");
  }

  lines.push(MANAGED_COMMENT);
  lines.push(filename);
  writeExclude(lines);
  return true;
}

export function stashDir(): string {
  return path.resolve(STASH_DIR_NAME);
}

export function manifestPath(): string {
  return path.join(stashDir(), STASH_MANIFEST);
}

export function readManifest(): StashManifest {
  const target = manifestPath();
  if (!fs.existsSync(target)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(target, "utf-8")) as StashManifest;
}

export function writeManifest(manifest: StashManifest): void {
  ensureDir(stashDir());
  fs.writeFileSync(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function stashFile(filePath: string): void {
  const stashedPath = path.join(stashDir(), filePath);
  ensureDir(path.dirname(stashedPath));

  fs.copyFileSync(path.resolve(filePath), stashedPath);

  const manifest = readManifest();
  manifest[filePath] = {
    stashedAt: new Date().toISOString(),
    size: fs.statSync(stashedPath).size,
  };
  writeManifest(manifest);
}

export function restoreFile(filePath: string): boolean {
  const stashedPath = path.join(stashDir(), filePath);
  const targetPath = path.resolve(filePath);

  if (!fs.existsSync(stashedPath)) {
    return false;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(stashedPath, targetPath);

  const manifest = readManifest();
  delete manifest[filePath];
  writeManifest(manifest);
  return true;
}

export function cleanupStash(): void {
  const target = stashDir();
  if (!fs.existsSync(target)) {
    return;
  }

  if (Object.keys(readManifest()).length === 0) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

export function findMountedRegistryLinks(root = process.cwd()): MountedRegistryLink[] {
  const mountedLinks: MountedRegistryLink[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.lstatSync(fullPath);

      if (stat.isSymbolicLink()) {
        const actualTarget = fs.readlinkSync(fullPath);
        const resolvedTarget = path.isAbsolute(actualTarget)
          ? actualTarget
          : path.resolve(path.dirname(fullPath), actualTarget);

        if (resolvedTarget.startsWith(REGISTRY_DIR)) {
          const relativePath = normalizeRegistryPath(path.relative(root, fullPath));
          mountedLinks.push({
            relativePath,
            fullPath,
            expectedSource: path.join(REGISTRY_DIR, relativePath),
            actualTarget,
            resolvedTarget,
          });
        }
      } else if (stat.isDirectory() && entry !== ".git" && entry !== STASH_DIR_NAME && entry !== "node_modules") {
        walk(fullPath);
      }
    }
  }

  walk(root);
  return mountedLinks;
}

export async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim().toLowerCase();
  } finally {
    rl.close();
  }
}