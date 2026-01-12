import React from "react";
import { GitBranch, Folder, Info, ChevronDown, ImageIcon, CornerDownLeft, Paperclip, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputButton,
  PromptInputMessage
} from "@/components/ai-elements/prompt-input";

interface MainViewProps {
  className?: string;
  workspaceRoot?: string;
  currentBranch?: string;
  lastModified?: string;
  status?: string;
  onSubmit: (msg: PromptInputMessage) => void;
  messages?: any[]; // Replace with proper type if available
  children?: React.ReactNode; // For chat history content
}

export function MainView({
  className,
  workspaceRoot = "/Users/erzenkrasniqi/Projects/erzencode",
  currentBranch = "Main branch (master)",
  lastModified = "2 seconds ago",
  status = "ready",
  onSubmit,
  children
}: MainViewProps) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Top Bar / Breadcrumbs */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>erzencode</span>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">New session</span>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
           <div className="flex items-center gap-1.5 text-emerald-500">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
             <span>127.0.0.1:4096</span>
           </div>
           <div className="flex items-center gap-1.5 text-emerald-500">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
             <span>2 MCP</span>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {isEmpty ? (
          <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full pt-20">
             {/* Project Info Cards */}
             <div className="space-y-6">
               <div className="flex items-start gap-3 text-muted-foreground">
                 <Folder className="h-5 w-5 mt-0.5" />
                 <div>
                   <div className="text-foreground text-sm font-medium">{workspaceRoot}</div>
                   <div className="text-xs mt-1 opacity-60">Project Root</div>
                 </div>
               </div>
               
               <div className="flex items-start gap-3 text-muted-foreground">
                 <GitBranch className="h-5 w-5 mt-0.5" />
                 <div>
                   <div className="text-foreground text-sm font-medium">{currentBranch}</div>
                   <div className="text-xs mt-1 opacity-60">Git Branch</div>
                 </div>
               </div>

               <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-4">
                 <Info className="h-3 w-3" />
                 <span>Last modified {lastModified}</span>
               </div>
             </div>
          </div>
        ) : (
          children
        )}

        {/* Input Area (Bottom) */}
        <div className="p-6 max-w-3xl mx-auto w-full">
          <PromptInput onSubmit={onSubmit} className="border border-border rounded-xl bg-muted/30 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all">
            <PromptInputBody className="relative">
              <PromptInputTextarea 
                placeholder="Ask anything... &quot;Optimize database queries&quot;" 
                className="min-h-[60px] p-4 text-base resize-none bg-transparent border-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
                autoFocus
              />
            </PromptInputBody>
            <PromptInputFooter className="px-3 pb-3 pt-0">
               <div className="flex items-center gap-2">
                 {/* Model/Mode Selectors */}
                 <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 rounded-md">
                   Build <ChevronDown className="h-3 w-3 opacity-50" />
                 </Button>
                 <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 rounded-md">
                   Claude Opus 4.5 Thinking (Antigravity) <ChevronDown className="h-3 w-3 opacity-50" />
                 </Button>
                 <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 rounded-md">
                   Max <ChevronDown className="h-3 w-3 opacity-50" />
                 </Button>
               </div>
               
               <div className="flex items-center gap-2">
                  <PromptInputTools>
                    <PromptInputButton className="hover:bg-muted/50 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </PromptInputButton>
                  </PromptInputTools>
                  <PromptInputSubmit className="h-8 w-8 rounded-lg bg-foreground text-background hover:bg-foreground/90" size="icon-sm">
                    <CornerDownLeft className="h-4 w-4" />
                  </PromptInputSubmit>
               </div>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
