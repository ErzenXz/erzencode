import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/file-system";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export interface OpenFile {
  path: string;
  content: string;
  modified?: boolean;
}

interface EditorTabsProps {
  files: OpenFile[];
  activePath?: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  className?: string;
}

export function EditorTabs({ files, activePath, onSelect, onClose, className }: EditorTabsProps) {
  if (files.length === 0) {
    return (
      <div className={cn("flex items-center border-b border-border px-4 py-2", className)}>
        <span className="text-xs text-muted-foreground">No files open</span>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className={cn("flex items-center border-b border-border", className)}>
        {files.map((file) => {
          const isActive = file.path === activePath;
          const fileName = file.path.split("/").pop() || file.path;

          return (
            <button
              key={file.path}
              className={cn(
                "group flex items-center gap-2 border-r border-border px-3 py-2 text-xs transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground"
              )}
              onClick={() => onSelect(file.path)}
            >
              {/* File Icon */}
              <span className="text-sm">{getFileIcon(fileName)}</span>

              {/* Filename */}
              <span className="max-w-[120px] truncate">{fileName}</span>

              {/* Modified Indicator */}
              {file.modified && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              )}

              {/* Close Button */}
              <button
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity",
                  "group-hover:opacity-100",
                  "hover:bg-accent"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(file.path);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

interface BreadcrumbsProps {
  path: string;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function Breadcrumbs({ path, onNavigate, className }: BreadcrumbsProps) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div className={cn("flex items-center gap-1 px-4 py-1.5 text-xs", className)}>
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        const fullPath = "/" + parts.slice(0, index + 1).join("/");

        return (
          <div key={fullPath} className="flex items-center">
            <span
              className={cn(
                "cursor-pointer transition-colors",
                isLast ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => !isLast && onNavigate?.(fullPath)}
            >
              {part}
            </span>
            {!isLast && <span className="mx-1 text-muted-foreground">/</span>}
          </div>
        );
      })}
    </div>
  );
}
