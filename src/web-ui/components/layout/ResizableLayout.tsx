import * as React from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface ResizableLayoutProps {
  children: [
    React.ReactNode, // Left panel (file tree)
    React.ReactNode, // Center panel (editor/preview)
    React.ReactNode, // Right panel (chat)
    React.ReactNode?, // Bottom panel (terminal) - optional
  ];
  defaultSizes?: {
    left?: number[];
    center?: number[];
    right?: number[];
    bottom?: number[];
  };
  className?: string;
}

export function ResizableLayout({
  children,
  defaultSizes = {},
  className,
}: ResizableLayoutProps) {
  const [left, center, right, bottom] = children;
  const hasBottom = !!bottom;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Main content area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - File Tree */}
        <ResizablePanel
          defaultSize={defaultSizes.left?.[0] ?? 20}
          minSize={15}
          maxSize={40}
        >
          {left}
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Editor/Preview */}
        <ResizablePanel
          defaultSize={defaultSizes.center?.[0] ?? 50}
          minSize={30}
        >
          {hasBottom ? (
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel
                defaultSize={defaultSizes.center?.[1] ?? 70}
                minSize={20}
              >
                {center}
              </ResizablePanel>
              {bottom && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    defaultSize={defaultSizes.bottom?.[0] ?? 30}
                    minSize={15}
                    maxSize={50}
                  >
                    {bottom}
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            center
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Chat */}
        <ResizablePanel
          defaultSize={defaultSizes.right?.[0] ?? 30}
          minSize={20}
          maxSize={50}
        >
          {right}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
