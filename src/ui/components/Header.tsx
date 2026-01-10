import React from "react";
import { Box, Text } from "ink";
import { truncate } from "../utils.js";

interface HeaderProps {
  workingDirectory: string;
}

export const Header: React.FC<HeaderProps> = ({ workingDirectory }) => {
  const dirName = workingDirectory.split("/").pop() || workingDirectory;

  return (
    <Box paddingX={1} marginBottom={0}>
      <Box gap={1}>
        <Text bold color="cyan">
          erzencode
        </Text>
        <Text color="gray" dimColor>
          in
        </Text>
        <Text color="white">{truncate(dirName, 30)}</Text>
      </Box>
    </Box>
  );
};
