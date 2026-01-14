/**
 * Project-level configuration for indexing.
 * Manages per-project settings stored globally.
 */

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { getDataDir } from "../config.js";
import type { ProjectIndexConfig, VoyageCodeModel } from "./types.js";

/**
 * Default project configuration.
 */
const DEFAULT_PROJECT_CONFIG: ProjectIndexConfig = {
  enabled: false,
  autoIndex: false,
  promptShown: false,
};

/**
 * Gets the projects directory.
 */
function getProjectsDir(): string {
  return path.join(getDataDir(), "projects");
}

/**
 * Generates a project ID from the project path.
 */
export function getProjectId(projectPath: string): string {
  const absolutePath = path.resolve(projectPath);
  return createHash("sha256").update(absolutePath).digest("hex").slice(0, 16);
}

/**
 * Gets the config file path for a project.
 */
function getProjectConfigPath(projectPath: string): string {
  const projectId = getProjectId(projectPath);
  return path.join(getProjectsDir(), projectId, "config.json");
}

/**
 * Loads project configuration.
 */
export async function loadProjectConfig(
  projectPath: string
): Promise<ProjectIndexConfig> {
  const configPath = getProjectConfigPath(projectPath);

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(content) as Partial<ProjectIndexConfig>;
    return { ...DEFAULT_PROJECT_CONFIG, ...config };
  } catch {
    return { ...DEFAULT_PROJECT_CONFIG };
  }
}

/**
 * Saves project configuration.
 */
export async function saveProjectConfig(
  projectPath: string,
  config: Partial<ProjectIndexConfig>
): Promise<void> {
  const configPath = getProjectConfigPath(projectPath);
  const existing = await loadProjectConfig(projectPath);
  const merged = { ...existing, ...config };

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(merged, null, 2), "utf-8");
}

/**
 * Checks if the first-run indexing prompt has been shown for a project.
 */
export async function wasPromptShown(projectPath: string): Promise<boolean> {
  const config = await loadProjectConfig(projectPath);
  return config.promptShown;
}

/**
 * Marks the first-run prompt as shown for a project.
 */
export async function markPromptShown(projectPath: string): Promise<void> {
  await saveProjectConfig(projectPath, { promptShown: true });
}

/**
 * Enables indexing for a project.
 */
export async function enableIndexing(
  projectPath: string,
  options: {
    autoIndex?: boolean;
    voyageModel?: VoyageCodeModel;
    excludePatterns?: string[];
  } = {}
): Promise<void> {
  await saveProjectConfig(projectPath, {
    enabled: true,
    promptShown: true,
    ...options,
  });
}

/**
 * Disables indexing for a project.
 */
export async function disableIndexing(projectPath: string): Promise<void> {
  await saveProjectConfig(projectPath, {
    enabled: false,
    promptShown: true,
  });
}

/**
 * Checks if indexing is enabled for a project.
 */
export async function isIndexingEnabled(projectPath: string): Promise<boolean> {
  const config = await loadProjectConfig(projectPath);
  return config.enabled;
}

/**
 * Gets the Voyage model preference for a project.
 */
export async function getProjectVoyageModel(
  projectPath: string
): Promise<VoyageCodeModel | undefined> {
  const config = await loadProjectConfig(projectPath);
  return config.voyageModel;
}

/**
 * Updates the last indexed timestamp.
 */
export async function updateLastIndexed(projectPath: string): Promise<void> {
  await saveProjectConfig(projectPath, { lastIndexed: Date.now() });
}

/**
 * Gets all project configurations.
 */
export async function getAllProjectConfigs(): Promise<
  Array<{ projectId: string; config: ProjectIndexConfig }>
> {
  const projectsDir = getProjectsDir();
  const results: Array<{ projectId: string; config: ProjectIndexConfig }> = [];

  try {
    const entries = await fs.readdir(projectsDir);

    for (const entry of entries) {
      const configPath = path.join(projectsDir, entry as string, "config.json");
      try {
        const content = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(content) as ProjectIndexConfig;
        results.push({ projectId: entry as string, config });
      } catch {
        // Skip invalid configs
      }
    }
  } catch {
    // Projects directory doesn't exist yet
  }

  return results;
}
