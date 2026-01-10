import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileSystemAPI, getFileIcon, FileEntry } from "@/lib/file-system";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileTreeProps {
  onFileSelect?: (path: string, content: string) => void;
  selectedPath?: string;
  className?: string;
}

export function FileTree({ onFileSelect, selectedPath, className }: FileTreeProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["."]));
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async (path: string = ".") => {
    setLoading(true);
    try {
      const result = await fileSystemAPI.listFiles(path);
      setFiles(result);
    } catch (e) {
      console.error("Failed to load files:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial files on mount
  useState(() => {
    loadFiles();
  });

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    if (entry.type === "directory") {
      toggleExpand(entry.path);
    } else if (onFileSelect) {
      try {
        const content = await fileSystemAPI.readFile(entry.path);
        onFileSelect(entry.path, content);
      } catch (e) {
        console.error("Failed to read file:", e);
      }
    }
  }, [onFileSelect, toggleExpand]);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Explorer</span>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {files.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={toggleExpand}
              onSelect={handleFileClick}
              level={0}
            />
          ))}
          {loading && (
            <div className="px-2 py-1 text-xs text-muted-foreground">Loading...</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface FileTreeItemProps {
  entry: FileEntry;
  expanded: Set<string>;
  selectedPath?: string;
  onToggle: (path: string) => void;
  onSelect: (entry: FileEntry) => void;
  level: number;
}

function FileTreeItem({ entry, expanded, selectedPath, onToggle, onSelect, level }: FileTreeItemProps) {
  const isExpanded = expanded.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isDirectory = entry.type === "directory";

  const handleClick = () => {
    onSelect(entry);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      onToggle(entry.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent text-accent-foreground",
          "cursor-pointer"
        )}
        style={{ paddingLeft: `${level * 12 + 6}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Icon */}
        <button
          className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={handleToggle}
        >
          {isDirectory ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </button>

        {/* File/Folder Icon */}
        <span className="text-sm">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-400" />
            ) : (
              <Folder className="h-4 w-4 text-blue-400" />
            )
          ) : (
            <span className="text-sm">{getFileIcon(entry.name)}</span>
          )}
        </span>

        {/* Filename */}
        <span className="truncate">{entry.name}</span>
      </div>

      {/* Children */}
      {isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
