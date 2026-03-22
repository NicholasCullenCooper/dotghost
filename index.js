#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Version (read from package.json at module root)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"));

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const REGISTRY_DIR = path.join(os.homedir(), ".dotghost");
const STASH_DIR_NAME = ".dotghost-stash";
const STASH_MANIFEST = "manifest.json";
const GIT_DIR = path.resolve(".git");
const GIT_EXCLUDE_FILE = path.join(GIT_DIR, "info", "exclude");

const MANAGED_COMMENT = "# dotghost-managed";

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const color = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function success(msg) {
  console.log(color.green(`✔ ${msg}`));
}
function warn(msg) {
  console.log(color.yellow(`⚠ ${msg}`));
}
function info(msg) {
  console.log(color.cyan(`ℹ ${msg}`));
}
function error(msg) {
  console.error(color.red(`✖ ${msg}`));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function requireGitRepo() {
  if (!fs.existsSync(GIT_DIR) || !fs.statSync(GIT_DIR).isDirectory()) {
    error("Must be run at the root of a Git repository.");
    process.exit(1);
  }
}

function requireRegistry() {
  if (!fs.existsSync(REGISTRY_DIR)) {
    error("Global registry does not exist. Run `dotghost init` first.");
    process.exit(1);
  }
}

function registryEntries(dir = REGISTRY_DIR, prefix = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry === ".git") continue;
    const fullPath = path.join(dir, entry);
    const relativePath = prefix ? path.join(prefix, entry) : entry;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...registryEntries(fullPath, relativePath));
    } else {
      results.push(relativePath);
    }
  }
  return results;
}

function gitCmd(args, cwd = REGISTRY_DIR) {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function isRegistryAGitRepo() {
  return fs.existsSync(path.join(REGISTRY_DIR, ".git"));
}

function requireRegistryGit() {
  requireRegistry();
  if (!isRegistryAGitRepo()) {
    error("Registry is not a Git repository. Use `dotghost init <git-url>` to set one up.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Git exclude management
// ---------------------------------------------------------------------------
function readExclude() {
  ensureDir(path.join(GIT_DIR, "info"));
  if (!fs.existsSync(GIT_EXCLUDE_FILE)) return [];
  return fs.readFileSync(GIT_EXCLUDE_FILE, "utf-8").split("\n");
}

function writeExclude(lines) {
  const content = lines.join("\n");
  fs.writeFileSync(GIT_EXCLUDE_FILE, content.endsWith("\n") ? content : content + "\n");
}

function addExclusion(filename) {
  const lines = readExclude();
  if (lines.some((l) => l.trim() === filename)) return false;
  const needsNewline = lines.length > 0 && lines[lines.length - 1] !== "";
  if (needsNewline) lines.push("");
  lines.push(MANAGED_COMMENT);
  lines.push(filename);
  writeExclude(lines);
  return true;
}

// ---------------------------------------------------------------------------
// Stash management
// ---------------------------------------------------------------------------
function stashDir() {
  return path.resolve(STASH_DIR_NAME);
}

function manifestPath() {
  return path.join(stashDir(), STASH_MANIFEST);
}

function readManifest() {
  const mp = manifestPath();
  if (!fs.existsSync(mp)) return {};
  return JSON.parse(fs.readFileSync(mp, "utf-8"));
}

function writeManifest(manifest) {
  ensureDir(stashDir());
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + "\n");
}

function stashFile(filePath) {
  const sd = stashDir();
  const stashedPath = path.join(sd, filePath);
  ensureDir(path.dirname(stashedPath));

  const sourcePath = path.resolve(filePath);
  fs.copyFileSync(sourcePath, stashedPath);

  const manifest = readManifest();
  manifest[filePath] = {
    stashedAt: new Date().toISOString(),
    size: fs.statSync(stashedPath).size,
  };
  writeManifest(manifest);
}

function restoreFile(filePath) {
  const stashedPath = path.join(stashDir(), filePath);
  const targetPath = path.resolve(filePath);

  if (!fs.existsSync(stashedPath)) return false;

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(stashedPath, targetPath);

  const manifest = readManifest();
  delete manifest[filePath];
  writeManifest(manifest);

  return true;
}

function cleanupStash() {
  const sd = stashDir();
  if (!fs.existsSync(sd)) return;
  const manifest = readManifest();
  if (Object.keys(manifest).length === 0) {
    fs.rmSync(sd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Interactive prompt
// ---------------------------------------------------------------------------
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function init() {
  const url = process.argv[3];

  if (url) {
    if (fs.existsSync(REGISTRY_DIR)) {
      error(`Registry already exists at ${REGISTRY_DIR}. Remove it first to re-clone.`);
      process.exit(1);
    }
    info(`Cloning ${url} into ${REGISTRY_DIR}...`);
    try {
      execSync(`git clone ${url} "${REGISTRY_DIR}"`, { stdio: "inherit" });
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

async function mount() {
  requireGitRepo();
  requireRegistry();

  const entries = registryEntries();
  if (entries.length === 0) {
    warn("Registry is empty — nothing to mount.");
    return;
  }

  const isWin = os.platform() === "win32";
  const forceAll = process.argv.includes("--force");
  const skipAll = process.argv.includes("--skip-conflicts");
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

      if (forceAll) {
        action = "overwrite";
      } else if (skipAll) {
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
            const diff = execSync(
              `diff --unified "${target}" "${source}"`,
              { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
            );
            console.log(diff || "   (files are identical)");
          } catch (e) {
            console.log(e.stdout || "   (binary or incomparable files)");
          }
          const answer2 = await ask(
            `   ${color.cyan("[o]")}verwrite (stash original)  ${color.cyan("[s]")}kip  > `,
          );
          if (answer2 === "o" || answer2 === "overwrite") action = "overwrite";
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
    const symlinkType = stat.isDirectory() ? (isWin ? "junction" : "dir") : "file";

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

function unmount() {
  requireGitRepo();

  const cwd = process.cwd();
  let removed = 0;

  function removeSymlinks(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.lstatSync(fullPath);

      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(fullPath);
        if (linkTarget.startsWith(REGISTRY_DIR)) {
          const relative = path.relative(cwd, fullPath);
          fs.unlinkSync(fullPath);
          success(`Unlinked ${relative}`);
          removed++;
        }
      } else if (stat.isDirectory() && entry !== ".git" && entry !== STASH_DIR_NAME && entry !== "node_modules") {
        removeSymlinks(fullPath);
        try {
          const remaining = fs.readdirSync(fullPath);
          if (remaining.length === 0) fs.rmdirSync(fullPath);
        } catch {
          // ignore
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
    const filtered = [];
    for (let i = 0; i < lines.length; i++) {
      if (
        i + 1 < lines.length &&
        lines[i].trim() === MANAGED_COMMENT
      ) {
        i++;
        continue;
      }
      if (lines[i].trim() === MANAGED_COMMENT) continue;
      filtered.push(lines[i]);
    }
    const cleaned = filtered.join("\n").replace(/\n{3,}/g, "\n\n");
    fs.writeFileSync(GIT_EXCLUDE_FILE, cleaned.endsWith("\n") ? cleaned : cleaned + "\n");
  }

  if (removed === 0 && restored === 0) {
    info("No dotghost symlinks or stashed files found.");
  } else {
    const parts = [];
    if (removed > 0) parts.push(`${removed} symlink${removed === 1 ? "" : "s"} removed`);
    if (restored > 0) parts.push(`${restored} original${restored === 1 ? "" : "s"} restored`);
    success(`Unmounted: ${parts.join(", ")}.`);
  }
}

function status() {
  const cwd = process.cwd();
  const mounted = [];

  function findMounted(dir) {
    if (!fs.existsSync(dir)) return;
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
    for (const f of mounted) {
      console.log(`   ${color.cyan(f)} -> ~/.dotghost/${f}`);
    }
  } else {
    console.log("⚪️ No dotghost symlinks detected in this directory.");
  }

  const manifest = readManifest();
  const stashedFiles = Object.keys(manifest);
  if (stashedFiles.length > 0) {
    console.log(color.yellow(`📦 ${stashedFiles.length} original${stashedFiles.length === 1 ? "" : "s"} stashed:`));
    for (const f of stashedFiles) {
      console.log(`   ${color.dim(f)} (${manifest[f].stashedAt.slice(0, 10)})`);
    }
  }

  if (isRegistryAGitRepo()) {
    try {
      const branch = gitCmd("rev-parse --abbrev-ref HEAD");
      const dirty = gitCmd("status --porcelain");
      const label = dirty ? color.yellow("(uncommitted changes)") : color.green("(clean)");
      info(`Registry git: ${branch} ${label}`);
    } catch {
      // not a concern if this fails
    }
  }
}

function pull() {
  requireRegistryGit();
  info("Pulling latest from remote...");
  try {
    const output = gitCmd("pull");
    console.log(color.dim(output));
    success("Registry updated.");
  } catch (e) {
    error(`Pull failed: ${e.message}`);
    process.exit(1);
  }
}

function push() {
  requireRegistryGit();

  const dirty = gitCmd("status --porcelain");
  if (!dirty) {
    info("Nothing to push — registry is clean.");
    return;
  }

  info("Staging all changes...");
  gitCmd("add -A");

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const msg = `dotghost: sync ${timestamp}`;
  gitCmd(`commit -m "${msg}"`);
  success(`Committed: ${msg}`);

  info("Pushing to remote...");
  try {
    const output = gitCmd("push");
    if (output) console.log(color.dim(output));
    success("Registry pushed.");
  } catch (e) {
    error(`Push failed: ${e.message}`);
    process.exit(1);
  }
}

function diff() {
  requireRegistryGit();
  const output = gitCmd("diff");
  const untrackedRaw = gitCmd("ls-files --others --exclude-standard");
  const untracked = untrackedRaw ? untrackedRaw.split("\n") : [];

  if (!output && untracked.length === 0) {
    info("No local changes in registry.");
    return;
  }

  if (output) console.log(output);
  if (untracked.length > 0) {
    console.log(color.yellow("\nUntracked files:"));
    for (const f of untracked) {
      console.log(`  ${color.cyan(f)}`);
    }
  }
}

function usage() {
  console.log(`
${color.bold("dotghost")} — Ghost your agent workflow registry into any repo.

${color.cyan("Usage:")}
  dotghost init [url]   Initialise registry, or clone from a git repo
  dotghost mount        Symlink registry files into the current Git repo root
  dotghost unmount      Remove symlinks, restore stashed originals
  dotghost status       Show mounted files, stashed originals, and registry git state

${color.cyan("Mount options:")}
  --force               Overwrite all conflicts without prompting (stashes originals)
  --skip-conflicts      Skip all conflicts without prompting

${color.cyan("Git sync:")}
  dotghost pull         Pull latest changes into the registry
  dotghost push         Commit and push local registry changes
  dotghost diff         Show uncommitted changes in the registry

${color.cyan("Example:")}
  dotghost init https://github.com/yourname/dotagent.git
  cd my-project && dotghost mount
`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const command = process.argv[2];

switch (command) {
  case "-v":
  case "--version":
  case "version":
    console.log(PKG.version);
    break;
  case "init":
    init();
    break;
  case "mount":
    mount();
    break;
  case "unmount":
    unmount();
    break;
  case "status":
    status();
    break;
  case "pull":
    pull();
    break;
  case "push":
    push();
    break;
  case "diff":
    diff();
    break;
  default:
    if (command) {
      error(`Unknown command: ${command}`);
    }
    usage();
    break;
}
