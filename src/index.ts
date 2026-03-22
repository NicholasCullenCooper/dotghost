#!/usr/bin/env node

import { Command } from "commander";

import {
  diffRegistry,
  initRegistry,
  listProfiles,
  mountRegistry,
  pullRegistry,
  pushRegistry,
  showVersion,
  statusRegistry,
  unmountRegistry,
} from "./commands.js";
import { MountSelection } from "./matching.js";
import { error } from "./output.js";
import { getProfileNames, getProfilesFileName, getRegistryProfile } from "./profiles.js";
import { PKG } from "./runtime.js";

interface MountOptions {
  force?: boolean;
  skipConflicts?: boolean;
  exclude?: string[];
  includeIgnored?: boolean;
  profile?: string;
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

function buildMountSelection(patterns: string[], options: MountOptions): MountSelection {
  const profile = options.profile ? getRegistryProfile(options.profile) : undefined;

  return {
    forceAll: Boolean(options.force),
    skipAll: Boolean(options.skipConflicts),
    includeIgnored: Boolean(options.includeIgnored) || Boolean(profile?.includeIgnored),
    includePatterns: [...(profile?.include ?? []), ...patterns],
    excludePatterns: [...(profile?.exclude ?? []), ...(options.exclude ?? [])],
  };
}

function buildMountHelpText(): string {
  const sections = [
    "",
    "Examples:",
    '  dotghost mount "AGENTS.md" "workflows/**"',
    '  dotghost mount --profile core',
    '  dotghost mount --exclude "skills/**"',
  ];

  try {
    const profileNames = getProfileNames();
    if (profileNames.length > 0) {
      sections.push("", `Profiles from ${getProfilesFileName()}:`, `  ${profileNames.join(", ")}`);
    }
  } catch {
    // Ignore help decoration failures when no registry exists or profile parsing fails.
  }

  return sections.join("\n");
}

function createProgram(): Command {
  const program = new Command();

  program
    .name("dotghost")
    .description("Ghost your agent workflow registry into any repo.")
    .version(PKG.version, "-v, --version", "output the current version")
    .showSuggestionAfterError(true)
    .showHelpAfterError();

  program
    .command("version")
    .description("Show the current version")
    .action(showVersion);

  program
    .command("init")
    .description("Initialise registry, or clone from a git repo")
    .argument("[url]", "git repository URL to clone into the registry")
    .action((url?: string) => {
      initRegistry(url);
    });

  program
    .command("mount")
    .description("Symlink matching registry files into the current Git repo root")
    .argument("[patterns...]", "registry-relative file paths or globs to include")
    .option("--force", "overwrite all conflicts without prompting (stashes originals)")
    .option("--skip-conflicts", "skip all conflicts without prompting")
    .option("--profile <name>", "mount a named profile from dotghost.profiles.json")
    .option("--exclude <glob>", "exclude matching files from the mount selection", collect, [])
    .option("--include-ignored", "ignore .dotghostignore and consider the full registry surface")
    .addHelpText("after", buildMountHelpText())
    .action(async (patterns: string[], options: MountOptions) => {
      await mountRegistry(buildMountSelection(patterns, options));
    });

  program.command("unmount").description("Remove symlinks, restore stashed originals").action(unmountRegistry);
  program.command("profiles").description("List named registry profiles").action(listProfiles);
  program.command("status").description("Show mounted files, stashed originals, and registry git state").action(statusRegistry);
  program.command("pull").description("Pull latest changes into the registry").action(pullRegistry);
  program.command("push").description("Commit and push local registry changes").action(pushRegistry);
  program.command("diff").description("Show uncommitted changes in the registry").action(diffRegistry);

  return program;
}

async function main(): Promise<void> {
  const program = createProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    error(message);
    process.exit(1);
  }
}

void main();