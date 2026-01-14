/**
 * Tool group component for rendering multiple tool calls.
 * Supports expand/collapse with ctrl+o.
 * Optimized with React.memo to prevent unnecessary rerenders.
 */

import React from "react";
import { Box } from "ink";
import type { ThemeColors, ToolPart } from "../../types.js";
import { ToolDisplay } from "./ToolDisplay.js";

export interface ToolGroupProps {
  tools: ToolPart[];
  msgId: string;
  groupIdx: number;
  workspaceRoot?: string;
  themeColors: ThemeColors;
  expandedTools?: boolean;
}

const ToolGroupImpl: React.FC<ToolGroupProps> = ({
  tools,
  msgId,
  groupIdx,
  workspaceRoot,
  themeColors,
  expandedTools = false,
}) => {
  return (
    <Box flexDirection="column">
      {tools.map((tool, idx) => (
        <ToolDisplay
          key={`${msgId}:tools:${groupIdx}:${idx}`}
          tool={tool}
          msgId={msgId}
          groupIdx={groupIdx}
          toolIdx={idx}
          workspaceRoot={workspaceRoot}
          themeColors={themeColors}
          isExpanded={expandedTools}
        />
      ))}
    </Box>
  );
};

// Memoize to prevent unnecessary rerenders
export const ToolGroup = React.memo(
  ToolGroupImpl,
  (prev, next) => {
    // Only re-render if tools array or expanded state changes
    if (prev.tools.length !== next.tools.length) return false;
    if (prev.expandedTools !== next.expandedTools) return false;
    if (prev.msgId !== next.msgId) return false;
    
    return prev.tools.every((t, i) => {
      const nextTool = next.tools[i];
      return t.name === nextTool.name && t.status === nextTool.status && t.output === nextTool.output;
    });
  }
);

ToolGroup.displayName = 'ToolGroup';
