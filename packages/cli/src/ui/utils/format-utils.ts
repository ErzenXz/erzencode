/**
 * Formatting utilities for the Terminal UI.
 * All functions are pure and have no side effects.
 */

/**
 * Generates a unique identifier string.
 * Combines timestamp with random characters for uniqueness.
 * @returns A unique ID string
 * @example
 * generateId() // "1704067200000-abc123d"
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Formats a token count for display with appropriate suffix.
 * @param n - Number of tokens
 * @returns Formatted string with K or M suffix
 * @example
 * formatTokens(1500) // "1.5K"
 * formatTokens(2500000) // "2.5M"
 */
export function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/**
 * Formats milliseconds into a human-readable time string.
 * @param ms - Time in milliseconds
 * @returns Formatted time string (e.g., "5s" or "2m 30s")
 * @example
 * formatTime(5000) // "5s"
 * formatTime(150000) // "2m 30s"
 */
export function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param n - The number to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 * @example
 * clamp(5, 0, 10) // 5
 * clamp(-5, 0, 10) // 0
 * clamp(15, 0, 10) // 10
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Gets display information for a tool based on its name and arguments.
 * @param toolName - The name of the tool
 * @param args - Optional arguments passed to the tool
 * @returns Object with display name and optional detail
 * @example
 * getToolDisplayName("read_file", { path: "/src/index.ts" })
 * // { name: "Read", detail: "index.ts" }
 */
export function getToolDisplayName(
  toolName: string,
  args?: Record<string, unknown>
): { name: string; detail?: string } {
  if (!args) return { name: toolName };

  const truncateStr = (str: string, len: number): string => {
    if (str.length <= len) return str;
    return str.slice(0, len - 3) + "...";
  };

  if (toolName === "read_file") {
    const path = (args.path || args.file_path || "") as string;
    const fileName = path.split("/").pop() || path;
    return { name: "Read", detail: fileName };
  }
  if (toolName === "write_file") {
    const path = (args.path || args.file_path || "") as string;
    const fileName = path.split("/").pop() || path;
    return { name: "Write", detail: fileName };
  }
  if (toolName === "edit_file") {
    const path = (args.path || args.file_path || "") as string;
    const fileName = path.split("/").pop() || path;
    return { name: "Edit", detail: fileName };
  }
  if (toolName === "read_files") {
    const paths = (args.paths || []) as string[];
    return { name: "Read", detail: `${paths.length} files` };
  }
  if (toolName === "file_tree") {
    return { name: "File tree", detail: (args.path || ".") as string };
  }
  if (toolName === "execute_command") {
    return {
      name: "Execute",
      detail: truncateStr((args.command || "") as string, 30),
    };
  }
  if (toolName === "grep" || toolName === "search_files") {
    return {
      name: "Search",
      detail: `"${truncateStr((args.pattern || args.query || "") as string, 20)}"`,
    };
  }

  return { name: toolName };
}

/**
 * Formats a file size in bytes to a human-readable string.
 * @param bytes - Size in bytes
 * @returns Formatted size string
 * @example
 * formatBytes(1024) // "1.0 KB"
 * formatBytes(1048576) // "1.0 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Formats a date timestamp to a relative time string.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 0) return `${seconds}s ago`;
  return "just now";
}
