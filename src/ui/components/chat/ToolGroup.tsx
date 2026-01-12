/**
 * Tool group component for rendering multiple tool calls.
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
}

const ToolGroupImpl: React.FC<ToolGroupProps> = ({
  tools,
  msgId,
  groupIdx,
  workspaceRoot,
  themeColors,
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
        />
      ))}
    </Box>
  );
};

// Memoize to prevent unnecessary rerenders
export const ToolGroup = React.memo(
  ToolGroupImpl,
  (prev, next) => {
    // Only re-render if tools array changes
    return (
      prev.tools.length === next.tools.length &&
      prev.tools.every((t, i) => {
        const nextTool = next.tools[i];
        return t.name === nextTool.name && t.status === nextTool.status;
      })
    );
  }
);

ToolGroup.displayName = 'ToolGroup';
