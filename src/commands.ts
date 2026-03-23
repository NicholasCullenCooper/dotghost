import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { applyRegistryIgnore, filterRegistryEntries, MountSelection, readRegistryIgnorePatterns } from "./matching.js";
import { color, error, info, success, warn } from "./output.js";
import { getProfilesFileName, getSuggestedProfileName, readRegistryProfiles } from "./profiles.js";
import {
  cloneRegistry,
  ensureDir,
  execDiff,
  getErrorOutput,
  GIT_EXCLUDE_FILE,
  gitCmd,
  isRegistryAGitRepo,
  PKG,
  REGISTRY_DIR,
  registryEntries,
  requireGitRepo,
  requireRegistry,
  requireRegistryGit,
  STASH_DIR_NAME,
} from "./runtime.js";
import {
  addExclusion,
  ask,
  cleanupStash,
  readExclude,
  readManifest,
  restoreFile,
  stashDir,
  stashFile,
} from "./workspace.js";

export function showVersion(): void {
  console.log(PKG.version);
}

export function initRegistry(url?: string): void {
  if (url) {
    if (fs.existsSync(REGISTRY_DIR)) {
      error(`Registry already exists at ${REGISTRY_DIR}. Remove it first to re-clone.`);
      process.exit(1);
    }

    info(`Cloning ${url} into ${REGISTRY_DIR}...`);
    try {
      cloneRegistry(url);
    } catch {
      error("Git clone failed.");
      process.exit(1);
    }
    success(`Registry cloned from ${url}`);
    return;
  }

  const created = !fs.existsSync(REGISTRY_DIR);
  ensureDir(REGISTRY_DIR);

  if (created) {
    success(`Created global registry at ${REGISTRY_DIR}`);
  } else {
    info(`Registry already exists at ${REGISTRY_DIR}`);
  }

  const placeholder = path.join(REGISTRY_DIR, "default-agent.md");
  if (!fs.existsSync(placeholder)) {
    fs.writeFileSync(
      placeholder,
      [
        "# Default Agent",
        "",
        "You are a helpful coding assistant.",
        "",
        "## Guidelines",
        "",
        "- Write clean, well-structured code.",
        "- Prefer simple solutions over clever ones.",
        "- Always explain your reasoning.",
        "",
      ].join("\n"),
    );
    success(`Created placeholder prompt: ${placeholder}`);
  } else {
    info("Placeholder prompt already exists — skipped.");
  }

  success("Registry initialised. Add your prompt files to ~/.dotghost (or use `dotghost init <url>` to clone your dotagent repo).");
}

export async function mountRegistry(selection: MountSelection): Promise<void> {
  requireGitRepo();
  requireRegistry();

  const allEntries = registryEntries();
  const ignorePatterns = selection.includeIgnored ? [] : readRegistryIgnorePatterns();
  const visibleEntries = applyRegistryIgnore(allEntries, ignorePatterns);
  const mountedWholeVisibleSurface = selection.includePatterns.length === 0
    && selection.excludePatterns.length === 0
    && !selection.includeIgnored;

  if (mountedWholeVisibleSurface) {
    try {
      const suggestedProfile = getSuggestedProfileName();
      if (suggestedProfile) {
        info(`No profile or glob selection provided. Mounting the full visible registry surface. Try \`dotghost mount --profile ${suggestedProfile}\` for a narrower default.`);
      }
    } catch {
      // Skip suggestion output if profile discovery fails; plain mounts should still work.
    }
  }

  const entries = filterRegistryEntries(visibleEntries, selection.includePatterns, selection.excludePatterns);

  if (entries.length === 0) {
    if (allEntries.length === 0) {
      warn("Registry is empty — nothing to mount.");
    } else if (visibleEntries.length === 0 && ignorePatterns.length > 0) {
      warn("Registry entries are fully hidden by .dotghostignore.");
    } else {
      warn("No registry files matched the requested mount selection.");
    }
    return;
  }

  if (ignorePatterns.length > 0 && !selection.includeIgnored) {
    const hiddenCount = allEntries.length - visibleEntries.length;
    if (hiddenCount > 0) {
      info(`.dotghostignore hid ${hiddenCount} registry file${hiddenCount === 1 ? "" : "s"}.`);
    }
  }

  if (selection.includePatterns.length > 0 || selection.excludePatterns.length > 0 || selection.includeIgnored) {
    info(`Mount selection matched ${entries.length} of ${visibleEntries.length} visible registry file${visibleEntries.length === 1 ? "" : "s"}.`);
  }

  const isWin = os.platform() === "win32";
  let linked = 0;
  let stashed = 0;

  for (const entry of entries) {
    const source = path.join(REGISTRY_DIR, entry);
    const target = path.resolve(entry);

    if (fs.existsSync(target)) {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(target);
        if (linkTarget === source) {
          info(`Already linked: ${entry}`);
          continue;
        }
      }

      let action = "skip";

      if (selection.forceAll) {
        action = "overwrite";
      } else if (selection.skipAll) {
        action = "skip";
      } else if (process.stdin.isTTY) {
        console.log("");
        warn(`${color.bold(entry)} already exists in this project.`);

        const localSize = fs.statSync(target).size;
        const registrySize = fs.statSync(source).size;
        console.log(`   Local:    ${localSize} bytes`);
        console.log(`   Registry: ${registrySize} bytes`);

        const answer = await ask(
          `   ${color.cyan("[o]")}verwrite (stash original)  ${color.cyan("[s]")}kip  ${color.cyan("[d]")}iff  > `,
        );

        if (answer === "d" || answer === "diff") {
          try {
            const diff = execDiff(target, source);
            console.log(diff || "   (files are identical)");
          } catch (cause) {
            console.log(getErrorOutput(cause) || "   (binary or incomparable files)");
          }

          const answer2 = await ask(
            `   ${color.cyan("[o]")}verwrite (stash original)  ${color.cyan("[s]")}kip  > `,
          );
          if (answer2 === "o" || answer2 === "overwrite") {
            action = "overwrite";
          }
        } else if (answer === "o" || answer === "overwrite") {
          action = "overwrite";
        }
      }

      if (action === "skip") {
        info(`Skipped ${entry}`);
        continue;
      }

      stashFile(entry);
      success(`Stashed original ${entry} → ${STASH_DIR_NAME}/${entry}`);

      const lstat = fs.lstatSync(target);
      if (lstat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
      stashed++;
    }

    ensureDir(path.dirname(target));

    const stat = fs.statSync(source);
    const symlinkType: fs.symlink.Type = stat.isDirectory() ? (isWin ? "junction" : "dir") : "file";
    fs.symlinkSync(source, target, symlinkType);

    const topLevel = entry.includes(path.sep) ? entry.split(path.sep)[0] : entry;
    addExclusion(topLevel);

    success(`Linked ${entry}`);
    linked++;
  }

  if (fs.existsSync(stashDir())) {
    addExclusion(STASH_DIR_NAME);
  }

  if (linked === 0) {
    info("All registry entries already linked or skipped.");
  } else {
    const stashMsg = stashed > 0 ? ` (${stashed} original${stashed === 1 ? "" : "s"} stashed)` : "";
    success(`Mounted ${linked} file${linked === 1 ? "" : "s"} from registry.${stashMsg}`);
  }
}

export function listProfiles(): void {
  requireRegistry();

  const profiles = readRegistryProfiles();
  const entries = Object.entries(profiles);

  if (entries.length === 0) {
    info(`No registry profiles found. Create ${getProfilesFileName()} in the registry to define named mount surfaces.`);
    return;
  }

  console.log(color.bold("Available profiles:"));
  for (const [name, profile] of entries) {
    const description = profile.description ? ` - ${profile.description}` : "";
    console.log(`  ${color.cyan(name)}${description}`);
    console.log(`    include: ${profile.include.join(", ")}`);
    if (profile.exclude && profile.exclude.length > 0) {
      console.log(`    exclude: ${profile.exclude.join(", ")}`);
    }
    if (profile.includeIgnored) {
      console.log("    includeIgnored: true");
    }
  }
}

export function unmountRegistry(): void {
  requireGitRepo();

  const cwd = process.cwd();
  let removed = 0;

  function removeSymlinks(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.lstatSync(fullPath);

      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(fullPath);
        if (linkTarget.startsWith(REGISTRY_DIR)) {
          fs.unlinkSync(fullPath);
          success(`Unlinked ${path.relative(cwd, fullPath)}`);
          removed++;
        }
      } else if (stat.isDirectory() && entry !== ".git" && entry !== STASH_DIR_NAME && entry !== "node_modules") {
        removeSymlinks(fullPath);
        try {
          if (fs.readdirSync(fullPath).length === 0) {
            fs.rmdirSync(fullPath);
          }
        } catch {
          // ignore disappearing or already-removed directories
        }
      }
    }
  }

  removeSymlinks(cwd);

  const manifest = readManifest();
  const stashedFiles = Object.keys(manifest);
  let restored = 0;

  for (const filePath of stashedFiles) {
    if (restoreFile(filePath)) {
      success(`Restored ${filePath} from stash`);
      restored++;
    }
  }

  cleanupStash();

  if (fs.existsSync(GIT_EXCLUDE_FILE)) {
    const lines = readExclude();
    const filtered: string[] = [];

    for (let index = 0; index < lines.length; index++) {
      if (index + 1 < lines.length && lines[index]?.trim() === "# dotghost-managed") {
        index++;
        continue;
      }
      if (lines[index]?.trim() === "# dotghost-managed") {
        continue;
      }
      filtered.push(lines[index] ?? "");
    }

    const cleaned = filtered.join("\n").replace(/\n{3,}/g, "\n\n");
    fs.writeFileSync(GIT_EXCLUDE_FILE, cleaned.endsWith("\n") ? cleaned : `${cleaned}\n`);
  }

  if (removed === 0 && restored === 0) {
    info("No dotghost symlinks or stashed files found.");
    return;
  }

  const parts: string[] = [];
  if (removed > 0) {
    parts.push(`${removed} symlink${removed === 1 ? "" : "s"} removed`);
  }
  if (restored > 0) {
    parts.push(`${restored} original${restored === 1 ? "" : "s"} restored`);
  }
  success(`Unmounted: ${parts.join(", ")}.`);
}

export function statusRegistry(): void {
  const cwd = process.cwd();
  const mounted: string[] = [];

  function findMounted(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.lstatSync(fullPath);

      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(fullPath);
        if (linkTarget.startsWith(REGISTRY_DIR)) {
          mounted.push(path.relative(cwd, fullPath));
        }
      } else if (stat.isDirectory() && entry !== ".git" && entry !== STASH_DIR_NAME && entry !== "node_modules") {
        findMounted(fullPath);
      }
    }
  }

  findMounted(cwd);

  if (mounted.length > 0) {
    console.log(color.green(`🟢 ${mounted.length} file${mounted.length === 1 ? "" : "s"} mounted:`));
    for (const entry of mounted) {
      console.log(`   ${color.cyan(entry)} -> ~/.dotghost/${entry}`);
    }
  } else {
    console.log("⚪️ No dotghost symlinks detected in this directory.");
  }

  const manifest = readManifest();
  const stashedFiles = Object.keys(manifest);
  if (stashedFiles.length > 0) {
    console.log(color.yellow(`📦 ${stashedFiles.length} original${stashedFiles.length === 1 ? "" : "s"} stashed:`));
    for (const filePath of stashedFiles) {
      const stashedAt = manifest[filePath]?.stashedAt.slice(0, 10) ?? "unknown";
      console.log(`   ${color.dim(filePath)} (${stashedAt})`);
    }
  }

  if (isRegistryAGitRepo()) {
    try {
      const branch = gitCmd(["rev-parse", "--abbrev-ref", "HEAD"]);
      const dirty = gitCmd(["status", "--porcelain"]);
      const label = dirty ? color.yellow("(uncommitted changes)") : color.green("(clean)");
      info(`Registry git: ${branch} ${label}`);
    } catch {
      // ignore registry git state failures in status output
    }
  }
}

export function pullRegistry(): void {
  requireRegistryGit();
  info("Pulling latest from remote...");
  try {
    const output = gitCmd(["pull"]);
    console.log(color.dim(output));
    success("Registry updated.");
  } catch (cause) {
    error(`Pull failed: ${getErrorOutput(cause)}`);
    process.exit(1);
  }
}

export function pushRegistry(): void {
  requireRegistryGit();

  const dirty = gitCmd(["status", "--porcelain"]);
  if (!dirty) {
    info("Nothing to push — registry is clean.");
    return;
  }

  info("Staging all changes...");
  gitCmd(["add", "-A"]);

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const message = `dotghost: sync ${timestamp}`;
  gitCmd(["commit", "-m", message]);
  success(`Committed: ${message}`);

  info("Pushing to remote...");
  try {
    const output = gitCmd(["push"]);
    if (output) {
      console.log(color.dim(output));
    }
    success("Registry pushed.");
  } catch (cause) {
    error(`Push failed: ${getErrorOutput(cause)}`);
    process.exit(1);
  }
}

export function diffRegistry(): void {
  requireRegistryGit();
  const output = gitCmd(["diff"]);
  const untrackedRaw = gitCmd(["ls-files", "--others", "--exclude-standard"]);
  const untracked = untrackedRaw ? untrackedRaw.split("\n") : [];

  if (!output && untracked.length === 0) {
    info("No local changes in registry.");
    return;
  }

  if (output) {
    console.log(output);
  }

  if (untracked.length > 0) {
    console.log(color.yellow("\nUntracked files:"));
    for (const filePath of untracked) {
      console.log(`  ${color.cyan(filePath)}`);
    }
  }
}