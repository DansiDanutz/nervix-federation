/**
 * ClawHub Publisher — packages and publishes the nervix-federation skill
 * to the OpenClaw ClawHub registry (https://clawhub.ai).
 *
 * API Reference: POST /api/v1/skills (multipart/form-data)
 * Auth: Bearer clh_... token
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";
import { createHash } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillFile {
  path: string;       // relative path within the skill bundle
  content: string;    // file content (text only)
  size: number;       // file size in bytes
  hash: string;       // sha256 hash of the content
}

export interface SkillBundle {
  slug: string;
  version: string;
  displayName: string;
  description: string;
  files: SkillFile[];
  totalSize: number;
  fileCount: number;
  bundleHash: string; // sha256 fingerprint of all file hashes combined
}

export interface PublishResult {
  success: boolean;
  slug?: string;
  version?: string;
  url?: string;
  error?: string;
  details?: string;
}

export interface ClawHubSkillInfo {
  slug: string;
  displayName: string;
  summary: string;
  tags: Record<string, string>;
  stats: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface ClawHubVersionInfo {
  version: string;
  createdAt: number;
  changelog?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CLAWHUB_BASE_URL = "https://clawhub.ai";
const CLAWHUB_API_V1 = `${CLAWHUB_BASE_URL}/api/v1`;
const MAX_BUNDLE_SIZE = 50 * 1024 * 1024; // 50MB max
const MAX_FILE_SIZE = 200 * 1024; // 200KB per file

// The skill lives at this path in the sandbox (development) or is bundled with the app
const SKILL_DIR = join(process.cwd(), "skill-bundle");
const FALLBACK_SKILL_DIR = "/home/ubuntu/skills/nervix-federation";

// ─── Skill Packaging ────────────────────────────────────────────────────────

/**
 * Recursively collect all files from a directory
 */
function collectFiles(dir: string, basePath: string = ""): SkillFile[] {
  const files: SkillFile[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath = basePath ? `${basePath}/${entry}` : entry;
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.startsWith(".") || entry === "node_modules") continue;
      files.push(...collectFiles(fullPath, relPath));
    } else if (stat.isFile()) {
      // Skip hidden files and binary files
      if (entry.startsWith(".")) continue;
      const content = readFileSync(fullPath, "utf-8");
      const hash = createHash("sha256").update(content).digest("hex");
      files.push({
        path: relPath,
        content,
        size: stat.size,
        hash,
      });
    }
  }
  return files;
}

/**
 * Parse YAML frontmatter from SKILL.md to extract metadata
 */
function parseFrontmatter(content: string): { name: string; description: string; version?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { name: "nervix-federation", description: "Nervix Global Agent Federation Skill" };
  }

  const yaml = match[1];
  const name = yaml.match(/^name:\s*(.+)$/m)?.[1]?.trim() || "nervix-federation";
  const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim() || "";
  const version = yaml.match(/^version:\s*(.+)$/m)?.[1]?.trim();

  return { name, description, version };
}

/**
 * Package the nervix-federation skill into a publishable bundle
 */
export function packageSkill(version?: string): SkillBundle {
  // Try the bundled skill dir first, then fallback
  const skillDir = existsSync(SKILL_DIR) ? SKILL_DIR : FALLBACK_SKILL_DIR;

  if (!existsSync(skillDir)) {
    throw new Error(`Skill directory not found at ${skillDir} or ${FALLBACK_SKILL_DIR}`);
  }

  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error("SKILL.md not found in skill directory");
  }

  const skillMdContent = readFileSync(skillMdPath, "utf-8");
  const frontmatter = parseFrontmatter(skillMdContent);

  const files = collectFiles(skillDir);

  // Validate
  if (files.length === 0) {
    throw new Error("No files found in skill directory");
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_BUNDLE_SIZE) {
    throw new Error(`Bundle size ${totalSize} exceeds maximum ${MAX_BUNDLE_SIZE}`);
  }

  const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
  if (oversizedFiles.length > 0) {
    throw new Error(`Files exceed 200KB limit: ${oversizedFiles.map(f => f.path).join(", ")}`);
  }

  // Compute bundle fingerprint
  const allHashes = files.map(f => f.hash).sort().join("");
  const bundleHash = createHash("sha256").update(allHashes).digest("hex");

  const resolvedVersion = version || frontmatter.version || "1.0.0";

  return {
    slug: frontmatter.name,
    version: resolvedVersion,
    displayName: "Nervix Federation",
    description: frontmatter.description,
    files,
    totalSize,
    fileCount: files.length,
    bundleHash,
  };
}

// ─── ClawHub API Client ─────────────────────────────────────────────────────

/**
 * Validate a ClawHub API token
 */
export async function validateToken(token: string): Promise<{ valid: boolean; handle?: string; error?: string }> {
  try {
    const res = await fetch(`${CLAWHUB_API_V1}/whoami`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, handle: data.handle || data.user?.handle };
    }
    return { valid: false, error: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * Check if the skill already exists on ClawHub
 */
export async function getSkillInfo(slug: string): Promise<{ exists: boolean; skill?: ClawHubSkillInfo; latestVersion?: ClawHubVersionInfo; error?: string }> {
  try {
    const res = await fetch(`${CLAWHUB_API_V1}/skills/${slug}`);
    if (res.ok) {
      const data = await res.json();
      return { exists: true, skill: data.skill, latestVersion: data.latestVersion };
    }
    if (res.status === 404) {
      return { exists: false };
    }
    return { exists: false, error: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err: any) {
    return { exists: false, error: err.message };
  }
}

/**
 * Search for the skill on ClawHub
 */
export async function searchSkills(query: string): Promise<any[]> {
  try {
    const res = await fetch(`${CLAWHUB_API_V1}/search?q=${encodeURIComponent(query)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Publish the skill bundle to ClawHub using multipart/form-data
 */
export async function publishToClawHub(
  bundle: SkillBundle,
  token: string,
  changelog?: string
): Promise<PublishResult> {
  try {
    // Build the payload JSON
    const payload = {
      slug: bundle.slug,
      version: bundle.version,
      displayName: bundle.displayName,
      description: bundle.description,
      changelog: changelog || `Version ${bundle.version} published from Nervix platform`,
      files: bundle.files.map(f => ({
        path: f.path,
        size: f.size,
        hash: f.hash,
      })),
    };

    // Build multipart form data
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));

    // Append each file as a blob
    for (const file of bundle.files) {
      const blob = new Blob([file.content], { type: "text/plain" });
      formData.append("files[]", blob, file.path);
    }

    const res = await fetch(`${CLAWHUB_API_V1}/skills`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        slug: bundle.slug,
        version: bundle.version,
        url: `${CLAWHUB_BASE_URL}/skills/${bundle.slug}`,
        details: JSON.stringify(data),
      };
    }

    const errorText = await res.text();
    return {
      success: false,
      error: `HTTP ${res.status}: ${errorText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Get the list of versions for a skill
 */
export async function getSkillVersions(slug: string): Promise<any[]> {
  try {
    const res = await fetch(`${CLAWHUB_API_V1}/skills/${slug}/versions?limit=20`);
    if (res.ok) {
      const data = await res.json();
      return data.items || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Resolve a local bundle hash to a known version on ClawHub
 */
export async function resolveVersion(slug: string, bundleHash: string): Promise<{ match?: string; latest?: string }> {
  try {
    const res = await fetch(`${CLAWHUB_API_V1}/resolve?slug=${slug}&hash=${bundleHash}`);
    if (res.ok) {
      const data = await res.json();
      return {
        match: data.match?.version,
        latest: data.latestVersion?.version,
      };
    }
    return {};
  } catch {
    return {};
  }
}

// ─── Automated Version Bumping ─────────────────────────────────────────────

export type BumpType = "patch" | "minor" | "major";

/**
 * Parse a semver string into its components
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return { major: 1, minor: 0, patch: 0 };
  return { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]) };
}

/**
 * Bump a semver version string
 */
export function bumpVersion(current: string, type: BumpType): string {
  const v = parseSemver(current);
  switch (type) {
    case "major": return `${v.major + 1}.0.0`;
    case "minor": return `${v.major}.${v.minor + 1}.0`;
    case "patch": return `${v.major}.${v.minor}.${v.patch + 1}`;
  }
}

/**
 * Detect what changed between the current bundle and the last published version.
 * Returns a suggested bump type and a list of changed files.
 */
export async function detectChanges(slug: string): Promise<{
  suggestedBump: BumpType;
  currentVersion: string;
  suggestedVersion: string;
  changedFiles: string[];
  newFiles: string[];
  removedFiles: string[];
  changeDescription: string;
}> {
  const bundle = packageSkill();
  const info = await getSkillInfo(slug);
  const currentVersion = info.latestVersion?.version || bundle.version;

  // If not published yet, suggest the current version as-is
  if (!info.exists) {
    return {
      suggestedBump: "minor",
      currentVersion: "0.0.0",
      suggestedVersion: bundle.version,
      changedFiles: bundle.files.map(f => f.path),
      newFiles: bundle.files.map(f => f.path),
      removedFiles: [],
      changeDescription: "Initial publish — all files are new",
    };
  }

  // Compare bundle hash with the resolved version
  const resolved = await resolveVersion(slug, bundle.bundleHash);
  if (resolved.match) {
    return {
      suggestedBump: "patch",
      currentVersion,
      suggestedVersion: currentVersion,
      changedFiles: [],
      newFiles: [],
      removedFiles: [],
      changeDescription: "No changes detected — bundle matches published version",
    };
  }

  // We can't do a file-by-file diff without the remote content,
  // so we use heuristics based on what files exist locally
  const skillMdChanged = bundle.files.some(f => f.path === "SKILL.md");
  const templateFiles = bundle.files.filter(f => f.path.startsWith("templates/"));
  const referenceFiles = bundle.files.filter(f => f.path.startsWith("references/"));
  const scriptFiles = bundle.files.filter(f => f.path.startsWith("scripts/"));

  // Heuristic: SKILL.md changes or new templates = minor, reference/script changes = patch
  let suggestedBump: BumpType = "patch";
  const reasons: string[] = [];

  if (skillMdChanged) {
    reasons.push("SKILL.md modified (core skill definition)");
    suggestedBump = "minor";
  }
  if (templateFiles.length > 0) {
    reasons.push(`${templateFiles.length} template file(s)`);
    suggestedBump = "minor";
  }
  if (referenceFiles.length > 0) {
    reasons.push(`${referenceFiles.length} reference doc(s)`);
  }
  if (scriptFiles.length > 0) {
    reasons.push(`${scriptFiles.length} script(s)`);
  }

  const suggestedVersion = bumpVersion(currentVersion, suggestedBump);

  return {
    suggestedBump,
    currentVersion,
    suggestedVersion,
    changedFiles: bundle.files.map(f => f.path),
    newFiles: [],
    removedFiles: [],
    changeDescription: reasons.length > 0
      ? `Changes detected: ${reasons.join(", ")}`
      : "Bundle hash differs from published version",
  };
}

/**
 * Get a comprehensive status report of the skill on ClawHub
 */
export async function getPublishingStatus(slug: string): Promise<{
  isPublished: boolean;
  slug: string;
  latestVersion?: string;
  totalVersions: number;
  lastUpdated?: number;
  stats?: Record<string, number>;
  url: string;
  error?: string;
}> {
  const info = await getSkillInfo(slug);
  const versions = info.exists ? await getSkillVersions(slug) : [];

  return {
    isPublished: info.exists,
    slug,
    latestVersion: info.latestVersion?.version,
    totalVersions: versions.length,
    lastUpdated: info.skill?.updatedAt,
    stats: info.skill?.stats,
    url: `${CLAWHUB_BASE_URL}/skills/${slug}`,
    error: info.error,
  };
}
