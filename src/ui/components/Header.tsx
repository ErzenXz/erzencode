/**
 * Header Component - Beautiful terminal UI with charm-tui styling
 * Minimal header that's part of the scrollable content
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import {
  gradientText,
  bold,
  dim,
} from "../utils/charm-ink.js";

interface HeaderProps {
  workingDirectory: string;
  version?: string;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  workingDirectory,
  version = "0.2.0",
}) => {
  // Memoize directory name extraction
  const dirName = useMemo(() =>
    workingDirectory.split("/").pop() || workingDirectory,
    [workingDirectory]
  );

  // Memoize styled text to prevent recomputation on every render
  const titleText = useMemo(() => gradientText("erzencode", "primary"), []);
  const versionText = useMemo(() => dim(`v${version}`), [version]);
  const inText = useMemo(() => dim("in"), []);
  const dirText = useMemo(() => bold(dirName), [dirName]);

  return (
    <Box paddingX={1} paddingY={0} flexDirection="row" justifyContent="space-between">
      <Box gap={1}>
        <Text>{titleText}</Text>
        <Text>{versionText}</Text>
        <Text>{inText}</Text>
        <Text>{dirText}</Text>
      </Box>
      <Box />
    </Box>
  );
});
