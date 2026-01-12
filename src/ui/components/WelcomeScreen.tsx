/**
 * Welcome Screen - Beautiful terminal UI with charm-tui styling
 * Shows branding, version, tips, and provider setup status
 */

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ThemeColors } from "../types.js";
import {
  gradientText,
  bold,
  dim,
  colored,
  theme as charmTheme,
} from "../utils/charm-ink.js";

interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
}

interface WelcomeScreenProps {
  workingDirectory: string;
  primaryColor: string;
  version: string;
  provider?: string;
  model?: string;
  providerStatuses?: ProviderStatus[];
  isCheckingProviders?: boolean;
  themeColors?: ThemeColors;
}

const TIPS = [
  "Type your message and press Enter to chat with the AI",
  "Use /help to see all available commands",
  "Use /models to switch between AI models",
  "Use /provider to change your AI provider",
  "Use /theme to customize the appearance",
  "Use /compact to summarize long conversations",
  "Press Ctrl+C to cancel a running request",
  "Use /image <path> to attach images (vision models)",
  "Use Tab to autocomplete commands",
  "Press Ctrl+M to switch between modes",
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  workingDirectory,
  primaryColor,
  version,
  provider,
  model,
  providerStatuses = [],
  isCheckingProviders = false,
  themeColors,
}) => {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const tip = TIPS[tipIndex] ?? TIPS[0];

  // Rotate tips every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const dirName = workingDirectory.split("/").pop() || workingDirectory;
  const configuredProviders = providerStatuses.filter((p) => p.configured);
  const hasAnyProvider = configuredProviders.length > 0;

  const textColor = themeColors?.text ?? "white";
  const textMuted = themeColors?.textMuted ?? "gray";
  const success = themeColors?.success ?? "green";
  const warning = themeColors?.warning ?? "yellow";

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Logo with gradient */}
      <Box marginBottom={1}>
        <Text>
          {gradientText(`╭─────────────────────────────────────────╮
│                                         │
│   ███████╗██████╗ ███████╗███████╗███╗  │
│   ██╔════╝██╔══██╗╚══███╔╝██╔════╝████╗ │
│   █████╗  ██████╔╝  ███╔╝ █████╗  ██╔██╗│
│   ██╔══╝  ██╔══██╗ ███╔╝  ██╔══╝  ██║╚██│
│   ███████╗██║  ██║███████╗███████╗██║ ╚█│
│   ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚│
│                                         │
╰─────────────────────────────────────────╯`, "cristal")}
        </Text>
      </Box>

      {/* Version and tagline with beautiful styling */}
      <Box marginBottom={1}>
        <Text>{gradientText("ErzenCode", "primary")}</Text>
        <Text> </Text>
        <Text>{dim(`v${version}`)}</Text>
        <Text> </Text>
        <Text>{dim("— AI-Powered Coding Assistant")}</Text>
      </Box>

      {/* Working directory */}
      <Box marginBottom={1}>
        <Text>{dim(`${figures.pointer} Working in `)}</Text>
        <Text>{bold(dirName, charmTheme.primary)}</Text>
      </Box>

      {/* Current configuration */}
      {provider && model && (
        <Box marginBottom={1} flexDirection="column">
          <Text>{dim("Current configuration:")}</Text>
          <Box paddingLeft={2}>
            <Text>{colored(figures.tick, charmTheme.success)} </Text>
            <Text>Provider: </Text>
            <Text>{colored(provider, charmTheme.yellow)}</Text>
            <Text>{dim(" • ")}</Text>
            <Text>Model: </Text>
            <Text>{colored(model, charmTheme.green)}</Text>
          </Box>
        </Box>
      )}

      {/* Provider status */}
      {isCheckingProviders ? (
        <Box marginBottom={1}>
          <Spinner type="dots" />
          <Text>{dim(" Checking provider configuration...")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          <Text>{dim("Provider status:")}</Text>
          <Box paddingLeft={2} flexDirection="column">
            {providerStatuses.slice(0, 6).map((p) => (
              <Box key={p.id}>
                <Text>
                  {p.configured 
                    ? colored(figures.tick, charmTheme.success)
                    : dim(figures.cross)}{" "}
                </Text>
                <Text>{p.configured ? p.name : dim(p.name)}</Text>
                {p.configured && provider === p.id && (
                  <Text>{colored(" (active)", charmTheme.primary)}</Text>
                )}
              </Box>
            ))}
            {providerStatuses.length > 6 && (
              <Text>{dim(`  ... and ${providerStatuses.length - 6} more`)}</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Setup prompt if no providers configured */}
      {!hasAnyProvider && !isCheckingProviders && (
        <Box 
          flexDirection="column" 
          marginY={1} 
          paddingX={2} 
          paddingY={1} 
          borderStyle="round" 
          borderColor={charmTheme.warning}
        >
          <Text>{colored(`${figures.warning} No API keys configured`, charmTheme.warning)}</Text>
          <Text>{dim("To get started, you'll need to configure at least one provider.")}</Text>
          <Box marginTop={1}>
            <Text>Press </Text>
            <Text>{bold("Enter", charmTheme.primary)}</Text>
            <Text> to start, then use </Text>
            <Text>{bold("/provider", charmTheme.primary)}</Text>
            <Text> to set up your API key.</Text>
          </Box>
        </Box>
      )}

      {/* Tip with beautiful styling */}
      <Box marginTop={1} marginBottom={1}>
        <Text>{colored(figures.info, charmTheme.info)} </Text>
        <Text>{dim(tip)}</Text>
      </Box>

      {/* Start prompt */}
      <Box marginTop={1}>
        <Text>Press </Text>
        <Text>{bold("Enter", charmTheme.primary)}</Text>
        <Text> to start chatting</Text>
        <Text>{dim(" • Ctrl+C to exit")}</Text>
      </Box>
    </Box>
  );
};
