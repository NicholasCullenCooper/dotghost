import fs from "node:fs";
import path from "node:path";

import { REGISTRY_DIR, REGISTRY_PROFILES_FILE, requireRegistry } from "./runtime.js";

export interface RegistryProfile {
    description?: string;
    include: string[];
    exclude?: string[];
    includeIgnored?: boolean;
}

type ProfileFileValue = string[] | RegistryProfile;

function profilesPath(): string {
    return path.join(REGISTRY_DIR, REGISTRY_PROFILES_FILE);
}

function levenshtein(left: string, right: string): number {
    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    for (let row = 0; row < rows; row++) {
        matrix[row]![0] = row;
    }
    for (let col = 0; col < cols; col++) {
        matrix[0]![col] = col;
    }

    for (let row = 1; row < rows; row++) {
        for (let col = 1; col < cols; col++) {
            const cost = left[row - 1] === right[col - 1] ? 0 : 1;
            matrix[row]![col] = Math.min(
                matrix[row - 1]![col]! + 1,
                matrix[row]![col - 1]! + 1,
                matrix[row - 1]![col - 1]! + cost,
            );
        }
    }

    return matrix[rows - 1]![cols - 1]!;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeProfile(name: string, value: ProfileFileValue): RegistryProfile {
    if (isStringArray(value)) {
        return { include: value };
    }

    if (typeof value !== "object" || value === null) {
        throw new Error(`Profile \"${name}\" must be an array of include globs or an object.`);
    }

    const include = "include" in value ? value.include : undefined;
    const exclude = "exclude" in value ? value.exclude : undefined;
    const description = "description" in value ? value.description : undefined;
    const includeIgnored = "includeIgnored" in value ? value.includeIgnored : undefined;

    if (!isStringArray(include)) {
        throw new Error(`Profile \"${name}\" must define an \"include\" array of globs.`);
    }

    if (exclude !== undefined && !isStringArray(exclude)) {
        throw new Error(`Profile \"${name}\" has an invalid \"exclude\" field. Expected an array of globs.`);
    }

    if (description !== undefined && typeof description !== "string") {
        throw new Error(`Profile \"${name}\" has an invalid \"description\" field. Expected a string.`);
    }

    if (includeIgnored !== undefined && typeof includeIgnored !== "boolean") {
        throw new Error(`Profile \"${name}\" has an invalid \"includeIgnored\" field. Expected a boolean.`);
    }

    return {
        include,
        exclude,
        description,
        includeIgnored,
    };
}

export function readRegistryProfiles(): Record<string, RegistryProfile> {
    requireRegistry();

    const filePath = profilesPath();
    if (!fs.existsSync(filePath)) {
        return {};
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`${REGISTRY_PROFILES_FILE} must contain a top-level object of named profiles.`);
    }

    const normalizedProfiles: Record<string, RegistryProfile> = {};
    for (const [name, value] of Object.entries(parsed)) {
        normalizedProfiles[name] = normalizeProfile(name, value as ProfileFileValue);
    }

    return normalizedProfiles;
}

export function getRegistryProfile(name: string): RegistryProfile {
    const profiles = readRegistryProfiles();
    const profileNames = Object.keys(profiles);
    const profile = profiles[name];
    if (!profile) {
        if (profileNames.length === 0) {
            throw new Error(`Unknown profile \"${name}\". No profiles are currently defined in ${REGISTRY_PROFILES_FILE}.`);
        }

        const suggestedProfile = profileNames
            .map((candidate) => ({ candidate, score: levenshtein(name, candidate) }))
            .sort((left, right) => left.score - right.score)[0];

        const suggestion = suggestedProfile && suggestedProfile.score <= 3 ? ` Did you mean \"${suggestedProfile.candidate}\"?` : "";
        throw new Error(
            `Unknown profile \"${name}\".${suggestion}\nAvailable profiles: ${profileNames.join(", ")}\nRun \`dotghost profiles\` for details.`,
        );
    }
    return profile;
}

export function getProfileNames(): string[] {
    return Object.keys(readRegistryProfiles());
}

export function getSuggestedProfileName(): string | undefined {
    const profileNames = getProfileNames();
    if (profileNames.length === 0) {
        return undefined;
    }

    return profileNames.includes("core") ? "core" : profileNames[0];
}

export function getProfilesFileName(): string {
    return REGISTRY_PROFILES_FILE;
}