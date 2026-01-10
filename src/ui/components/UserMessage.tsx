import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../types.js";

interface UserMessageProps {
  message: ChatMessage;
  width: number;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message, width }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      marginBottom={1}
      width={Math.min(width - 4, 80)}
    >
      <Text wrap="wrap">{message.content}</Text>
    </Box>
  );
};
