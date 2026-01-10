import React from "react";
import { Box, Text } from "ink";

interface WelcomeScreenProps {
  workingDirectory: string;
  primaryColor: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  workingDirectory,
  primaryColor,
}) => {
  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color={primaryColor}>
        {`
  _____ ____  __________ _   ____________  ____  ______
 / __  / __ \\/_  __/ __// | / / ___/ __ \\/ __ \\/ ____/
/ /_/ / /_/ / / / / _/ /  |/ / /__/ /_/ / / / / __/   
\\____/\\____/ /_/ /___/_/|___/\\___/\\____/_/_/_/____/   
        `.trim()}
      </Text>
      <Text color="gray">AI-Powered Coding Assistant</Text>
      <Box marginTop={1}>
        <Text color="gray">
          Working in: <Text color={primaryColor}>{workingDirectory}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          Press <Text color={primaryColor} bold>Enter</Text> to start
        </Text>
      </Box>
    </Box>
  );
};
