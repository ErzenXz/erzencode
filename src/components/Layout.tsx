import React from "react";
import { Box, Text, useStdout } from "ink";
import figures from "figures";

interface LayoutProps {
  header: React.ReactNode;
  main: React.ReactNode;
  sidebar: React.ReactNode;
  footer: React.ReactNode;
  modal?: React.ReactNode;
  sidebarWidth?: number;
}

export const Layout: React.FC<LayoutProps> = ({
  header,
  main,
  sidebar,
  footer,
  modal,
  sidebarWidth = 35,
}) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 100;
  const terminalHeight = stdout?.rows ?? 30;

  const mainWidth = terminalWidth - sidebarWidth - 4;
  const contentHeight = terminalHeight - 8;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* Header */}
      <Box flexDirection="column">{header}</Box>

      {/* Main Content Area with Sidebar */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Main Content */}
        <Box
          flexDirection="column"
          width={mainWidth}
          flexGrow={1}
          paddingRight={1}
        >
          <Box
            flexDirection="column"
            height={contentHeight}
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            overflow="hidden"
          >
            {main}
          </Box>
        </Box>

        {/* Vertical Divider */}
        <Box width={1} paddingX={0}>
          <Text color="gray">│</Text>
        </Box>

        {/* Right Sidebar */}
        <Box flexDirection="column" width={sidebarWidth} flexShrink={0}>
          <Box
            flexDirection="column"
            height={contentHeight}
            overflow="hidden"
          >
            {sidebar}
          </Box>
        </Box>
      </Box>

      {/* Footer / Input Area */}
      <Box flexDirection="column" marginTop={1}>
        {footer}
      </Box>

      {/* Modal Overlay */}
      {modal && (
        <Box
          position="absolute"
          width={terminalWidth}
          height={terminalHeight}
          justifyContent="center"
          alignItems="center"
          flexDirection="column"
        >
          {/* Semi-transparent background effect */}
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor="cyan"
            paddingX={2}
            paddingY={1}
          >
            {modal}
          </Box>
        </Box>
      )}
    </Box>
  );
};

interface HeaderProps {
  title: string;
  subtitle?: string;
  sessionName: string;
  sessionNumber?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  sessionName,
  sessionNumber,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      paddingX={2}
      paddingY={0}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Box gap={2}>
          <Text bold color="cyan">
            {title}
          </Text>
          {subtitle && (
            <Text color="gray" dimColor>
              {subtitle}
            </Text>
          )}
        </Box>
        <Box gap={2}>
          {sessionNumber !== undefined && sessionNumber > 0 && (
            <Text color="gray" dimColor>
              Session <Text>{sessionNumber}</Text>
            </Text>
          )}
          <Text color="yellow">{sessionName}</Text>
        </Box>
      </Box>
    </Box>
  );
};

interface StatusBarProps {
  status: string;
  activeTools?: number;
  isThinking?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  activeTools = 0,
  isThinking = false,
}) => {
  return (
    <Box
      borderStyle="round"
      borderColor={isThinking ? "magenta" : activeTools > 0 ? "yellow" : "gray"}
      paddingX={1}
    >
      <Box gap={2}>
        <Text color="gray">{figures.bullet}</Text>
        <Text color={isThinking ? "magenta" : activeTools > 0 ? "yellow" : "gray"}>
          {status}
        </Text>
        {activeTools > 0 && (
          <Text color="yellow">
            {figures.play} <Text>{activeTools}</Text> tool<Text>{activeTools > 1 ? "s" : ""}</Text> running
          </Text>
        )}
        {isThinking && (
          <Text color="magenta">{figures.pointer} Thinking...</Text>
        )}
      </Box>
    </Box>
  );
};
