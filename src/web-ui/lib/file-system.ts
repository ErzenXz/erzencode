export type FileType = "file" | "directory";

export interface FileEntry {
  name: string;
  type: FileType;
  path: string;
  size?: number;
  children?: FileEntry[];
}

export interface FileContent {
  path: string;
  content: string;
}

class FileSystemAPI {
  private baseUrl = "/api";

  async listFiles(path: string = "."): Promise<FileEntry[]> {
    const response = await fetch(`${this.baseUrl}/files?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }
    const data = await response.json();
    return data.files || [];
  }

  async readFile(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/files/content?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    const data = await response.json();
    return data.content || "";
  }

  async writeFile(path: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/files/content?path=${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.statusText}`);
    }
  }

  async deleteFile(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  async createDirectory(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/files/mkdir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create directory: ${response.statusText}`);
    }
  }

  async moveFile(from: string, to: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/files/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    if (!response.ok) {
      throw new Error(`Failed to move file: ${response.statusText}`);
    }
  }
}

export const fileSystemAPI = new FileSystemAPI();

// Get file icon based on extension
export function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    ts: "📘",
    tsx: "⚛️",
    js: "📜",
    jsx: "⚛️",
    css: "🎨",
    scss: "🎨",
    html: "🌐",
    json: "📋",
    md: "📝",
    txt: "📄",
    py: "🐍",
    rs: "🦀",
    go: "🐹",
    java: "☕",
    cpp: "⚙️",
    c: "⚙️",
    h: "📜",
    svg: "🖼️",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    git: "🔧",
    env: "🔐",
    dockerfile: "🐳",
  };
  return iconMap[ext || ""] || "📄";
}

// Get file color for syntax highlighting
export function getFileColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    ts: "var(--file-ts)",
    tsx: "var(--file-tsx)",
    js: "var(--file-js)",
    jsx: "var(--file-jsx)",
    css: "var(--file-css)",
    html: "var(--file-html)",
    json: "var(--file-json)",
    md: "var(--file-md)",
    py: "var(--file-py)",
    rs: "var(--file-rs)",
    go: "var(--file-go)",
  };
  return colorMap[ext || ""] || "var(--file-default)";
}
