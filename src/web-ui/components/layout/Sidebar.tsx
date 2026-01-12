import React from "react";
import { Plus, MessageSquare, ExternalLink, Settings, MessageCircle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
  sessions?: Array<{
    id: string;
    name: string;
    updatedAt?: number;
    createdAt?: number;
    stats?: { added: number; deleted: number; files: number };
  }>;
  currentSessionId?: string;
  onSessionSelect?: (id: string) => void;
  onNewSession?: () => void;
  onOpenSettings?: () => void;
}

function formatTimeAgo(timestamp?: number) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function Sidebar({
  className,
  sessions = [],
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onOpenSettings,
}: SidebarProps) {
  return (
    <div className={cn("flex h-full flex-col bg-background border-r border-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 h-14 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white font-bold text-xs">
            E
          </div>
          <span className="font-semibold text-sm">erzencode</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onNewSession}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-0.5">
          {sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <button
                key={session.id}
                onClick={() => onSessionSelect?.(session.id)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-md transition-colors group relative flex flex-col gap-1",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate text-sm font-medium pr-8 leading-none">
                    {session.name || "Untitled Session"}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 absolute right-3 top-3.5">
                    {formatTimeAgo(session.updatedAt || session.createdAt)}
                  </span>
                </div>
                
                {session.stats ? (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                    <span>{session.stats.files} file{session.stats.files !== 1 ? 's' : ''} changed</span>
                    <span className="text-emerald-500">+{session.stats.added}</span>
                    <span className="text-red-500">-{session.stats.deleted}</span>
                  </div>
                ) : (
                   <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                    <span>No changes</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-2 space-y-1 border-t border-border/40">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-9 px-3 text-muted-foreground hover:text-foreground"
          onClick={onOpenSettings}
        >
          <Plus className="h-4 w-4" />
          Connect provider
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-9 px-3 text-muted-foreground hover:text-foreground"
        >
          <FolderOpen className="h-4 w-4" />
          Open project
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-9 px-3 text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          Share feedback
        </Button>
      </div>
    </div>
  );
}
