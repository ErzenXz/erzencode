import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import type { ProviderType } from "../../ai-provider.js";
import type { AgentMode as CodingAgentMode } from "../../ai-agent.js";
import type {
  SessionState,
  SlashCommand,
  ThemeColors,
  ThinkingLevel,
} from "../types.js";
import {
  MODE_COLORS,
  SLASH_COMMANDS,
  THINKING_LEVELS,
  THINKING_LEVEL_DESCRIPTIONS,
} from "../types.js";
import { formatTokens, truncate } from "../utils.js";

interface ModalContainerProps {
  title: string;
  children: React.ReactNode;
  footer?: string;
  width?: number;
  borderColor?: string;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
  title,
  children,
  footer,
  width = 60,
  borderColor = "cyan",
}) => (
  <Box
    flexDirection="column"
    borderStyle="double"
    borderColor={borderColor}
    paddingX={2}
    paddingY={1}
    width={width}
  >
    <Box marginBottom={1}>
      <Text bold color={borderColor}>
        {figures.pointer} {title}
      </Text>
    </Box>
    {children}
    {footer && (
      <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
        <Text color="gray" dimColor>
          {footer}
        </Text>
      </Box>
    )}
  </Box>
);

interface HelpModalProps {
  themeColors: ThemeColors;
}

export const HelpModal: React.FC<HelpModalProps> = ({ themeColors }) => (
  <ModalContainer
    title="Help & Shortcuts"
    width={65}
    footer="ESC to close"
    borderColor={themeColors.primary}
  >
    <Box flexDirection="column">
      <Text bold color={themeColors.warning}>
        Commands:
      </Text>
      {SLASH_COMMANDS.map((cmd) => (
        <Box key={cmd.name} gap={1}>
          <Text color={themeColors.primary}>/{cmd.name}</Text>
          {cmd.aliases && <Text color="gray">({cmd.aliases.join(", ")})</Text>}
          <Text color="gray">- {cmd.description}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text bold color={themeColors.warning}>
          Shortcuts:
        </Text>
      </Box>
      <Text>
        <Text color={themeColors.primary}>Tab</Text> - Switch mode
      </Text>
      <Text>
        <Text color="cyan">ESC ESC</Text> - Cancel AI
      </Text>
      <Text>
        <Text color="cyan">↑/↓</Text> - History / Navigate
      </Text>
      <Text>
        <Text color="cyan">Ctrl+C</Text> - Exit
      </Text>
    </Box>
  </ModalContainer>
);

interface ThemeModalProps {
  themes: Array<{ id: string; name: string }>;
  currentThemeId: string;
  selectedIndex: number;
  themeColors: ThemeColors;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  themes,
  currentThemeId,
  selectedIndex,
  themeColors,
}) => {
  const maxVisible = 12;
  const windowStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      themes.length - maxVisible,
    ),
  );
  const visibleThemes = themes.slice(windowStart, windowStart + maxVisible);

  return (
    <ModalContainer
      title="Select Theme"
      width={65}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
      borderColor={themeColors.primary}
    >
      <Box
        flexDirection="column"
        height={Math.min(maxVisible + 1, themes.length + 1)}
      >
        {visibleThemes.map((t, idx) => {
          const actualIdx = windowStart + idx;
          return (
            <Box key={t.id}>
              <Text
                color={
                  actualIdx === selectedIndex
                    ? themeColors.primary
                    : t.id === currentThemeId
                      ? themeColors.success
                      : themeColors.text
                }
                bold={actualIdx === selectedIndex}
              >
                {actualIdx === selectedIndex ? figures.pointer : " "} {t.name}{" "}
                <Text color={themeColors.textMuted} dimColor>
                  - {t.id}
                </Text>{" "}
                {t.id === currentThemeId && (
                  <Text color={themeColors.success}>✓</Text>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>
    </ModalContainer>
  );
};

interface ModelsModalProps {
  provider: ProviderType;
  models: string[];
  currentModel: string;
  selectedIndex: number;
  isLoading: boolean;
  themeColors: ThemeColors;
}

export const ModelsModal: React.FC<ModelsModalProps> = ({
  provider,
  models,
  currentModel,
  selectedIndex,
  isLoading,
  themeColors,
}) => {
  const maxVisible = 12;
  const windowStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      models.length - maxVisible,
    ),
  );
  const visibleModels = models.slice(windowStart, windowStart + maxVisible);

  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < models.length;

  return (
    <ModalContainer
      title={`Select Model (${provider})`}
      width={55}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
      borderColor={themeColors.primary}
    >
      <Box
        flexDirection="column"
        height={Math.min(maxVisible + 2, models.length + 2)}
      >
        {isLoading ? (
          <Box gap={1}>
            <Spinner type="dots" />
            <Text>Loading models...</Text>
          </Box>
        ) : (
          <>
            {showScrollUp && (
              <Text color="gray" dimColor>
                {figures.arrowUp} {windowStart} more above
              </Text>
            )}
            {visibleModels.map((m, idx) => {
              const actualIdx = windowStart + idx;
              return (
                <Box key={m}>
                  <Text
                    color={
                      actualIdx === selectedIndex
                        ? "cyan"
                        : m === currentModel
                          ? "green"
                          : "white"
                    }
                    bold={actualIdx === selectedIndex}
                  >
                    {actualIdx === selectedIndex ? figures.pointer : " "}{" "}
                    {truncate(m, 45)}{" "}
                    {m === currentModel && <Text color="green">✓</Text>}
                  </Text>
                </Box>
              );
            })}
            {showScrollDown && (
              <Text color="gray" dimColor>
                {figures.arrowDown} {models.length - windowStart - maxVisible}{" "}
                more below
              </Text>
            )}
          </>
        )}
      </Box>
    </ModalContainer>
  );
};

interface SessionsModalProps {
  sessions: SessionState[];
  currentSessionId: string;
  selectedIndex: number;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({
  sessions,
  currentSessionId,
  selectedIndex,
}) => {
  const maxVisible = 10;
  const windowStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      sessions.length - maxVisible,
    ),
  );
  const visibleSessions = sessions.slice(windowStart, windowStart + maxVisible);

  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < sessions.length;

  return (
    <ModalContainer
      title="Sessions"
      width={50}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
    >
      <Box flexDirection="column">
        {showScrollUp && (
          <Text color="gray" dimColor>
            {figures.arrowUp} {windowStart} more above
          </Text>
        )}
        {visibleSessions.map((s, idx) => {
          const actualIdx = windowStart + idx;
          return (
            <Box key={s.id} gap={1}>
              <Text
                color={
                  actualIdx === selectedIndex
                    ? "cyan"
                    : s.id === currentSessionId
                      ? "green"
                      : "white"
                }
                bold={actualIdx === selectedIndex}
              >
                {actualIdx === selectedIndex ? figures.pointer : " "} {s.name}{" "}
                <Text color="gray">
                  (<Text>{s.messages.length}</Text>)
                </Text>
                {s.id === currentSessionId && <Text color="green">✓</Text>}
              </Text>
            </Box>
          );
        })}
        {showScrollDown && (
          <Text color="gray" dimColor>
            {figures.arrowDown} {sessions.length - windowStart - maxVisible}{" "}
            more below
          </Text>
        )}
      </Box>
    </ModalContainer>
  );
};

interface ProviderModalProps {
  providers: Array<{ id: string; name: string }>;
  currentProvider: ProviderType;
  selectedIndex: number;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  providers,
  currentProvider,
  selectedIndex,
}) => {
  const maxVisible = 12;
  const windowStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisible / 2),
      providers.length - maxVisible,
    ),
  );
  const visibleProviders = providers.slice(
    windowStart,
    windowStart + maxVisible,
  );

  const showScrollUp = windowStart > 0;
  const showScrollDown = windowStart + maxVisible < providers.length;

  return (
    <ModalContainer
      title="Select Provider"
      width={45}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
    >
      <Box flexDirection="column">
        {showScrollUp && (
          <Text color="gray" dimColor>
            {figures.arrowUp} {windowStart} more above
          </Text>
        )}
        {visibleProviders.map((p, idx) => {
          const actualIdx = windowStart + idx;
          return (
            <Box key={p.id}>
              <Text
                color={
                  actualIdx === selectedIndex
                    ? "cyan"
                    : p.id === currentProvider
                      ? "green"
                      : "white"
                }
                bold={actualIdx === selectedIndex}
              >
                {actualIdx === selectedIndex ? figures.pointer : " "} {p.name}{" "}
                {p.id === currentProvider && <Text color="green">✓</Text>}
              </Text>
            </Box>
          );
        })}
        {showScrollDown && (
          <Text color="gray" dimColor>
            {figures.arrowDown} {providers.length - windowStart - maxVisible}{" "}
            more below
          </Text>
        )}
      </Box>
    </ModalContainer>
  );
};

interface SettingsModalProps {
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  workingDirectory: string;
  sessionTokens: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  provider,
  model,
  mode,
  workingDirectory,
  sessionTokens,
}) => (
  <ModalContainer
    title="Settings"
    width={50}
    borderColor="yellow"
    footer="ESC to close"
  >
    <Box flexDirection="column" gap={1}>
      <Text>
        <Text color="gray">Provider:</Text>{" "}
        <Text color="yellow">{provider}</Text>
      </Text>
      <Text>
        <Text color="gray">Model:</Text> <Text color="green">{model}</Text>
      </Text>
      <Text>
        <Text color="gray">Mode:</Text>{" "}
        <Text color={MODE_COLORS[mode]}>{mode}</Text>
      </Text>
      <Text>
        <Text color="gray">Directory:</Text>{" "}
        <Text color="cyan">{truncate(workingDirectory, 30)}</Text>
      </Text>
      <Text>
        <Text color="gray">Tokens:</Text>{" "}
        <Text>{formatTokens(sessionTokens)}</Text>
      </Text>
    </Box>
  </ModalContainer>
);

interface ApiKeyModalProps {
  provider: string;
  providerName: string;
  envVar: string;
  apiKeyInput: string;
  cursorIndex: number;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  provider,
  providerName,
  envVar,
  apiKeyInput,
  cursorIndex,
}) => {
  const maskedValue =
    apiKeyInput.length > 0
      ? apiKeyInput.slice(0, 4) +
        "•".repeat(Math.max(0, apiKeyInput.length - 4))
      : "";
  const cursor = "│";
  const safeCursorIndex = Math.max(
    0,
    Math.min(cursorIndex, maskedValue.length),
  );
  const displayValue =
    maskedValue.length === 0
      ? cursor
      : maskedValue.slice(0, safeCursorIndex) +
        cursor +
        maskedValue.slice(safeCursorIndex);

  return (
    <ModalContainer
      title={`API Key Required: ${providerName}`}
      width={55}
      borderColor="yellow"
      footer="Enter to save • ESC to cancel"
    >
      <Box flexDirection="column" gap={1}>
        <Text color="gray">Enter your API key for {providerName}.</Text>
        <Text color="gray" dimColor>
          Or set the environment variable: {envVar}
        </Text>
        <Box marginTop={1}>
          <Text color="gray">API Key: </Text>
          <Box borderStyle="round" borderColor="cyan" paddingX={1} width={40}>
            <Text>{displayValue || cursor}</Text>
          </Box>
        </Box>
        <Text color="gray" dimColor>
          Key will be saved to ~/.config/erzencode/global.json
        </Text>
      </Box>
    </ModalContainer>
  );
};

interface ThinkingModalProps {
  currentLevel: ThinkingLevel;
  selectedIndex: number;
  supportsThinking: boolean;
  themeColors: ThemeColors;
}

export const ThinkingModal: React.FC<ThinkingModalProps> = ({
  currentLevel,
  selectedIndex,
  supportsThinking,
  themeColors,
}) => {
  return (
    <ModalContainer
      title="Thinking Level"
      width={55}
      footer="↑↓ Navigate • Enter Select • ESC Cancel"
      borderColor={themeColors.primary}
    >
      <Box flexDirection="column">
        {!supportsThinking && (
          <Box marginBottom={1}>
            <Text color={themeColors.warning}>
              {figures.warning} Current model may not support native thinking
            </Text>
          </Box>
        )}
        {THINKING_LEVELS.map((level, idx) => (
          <Box key={level} flexDirection="column">
            <Text
              color={
                idx === selectedIndex
                  ? themeColors.primary
                  : level === currentLevel
                    ? themeColors.success
                    : themeColors.text
              }
              bold={idx === selectedIndex}
            >
              {idx === selectedIndex ? figures.pointer : " "}{" "}
              {level.charAt(0).toUpperCase() + level.slice(1)}{" "}
              {level === currentLevel && (
                <Text color={themeColors.success}>✓</Text>
              )}
            </Text>
            <Text color={themeColors.textMuted} dimColor>
              {"  "}
              {THINKING_LEVEL_DESCRIPTIONS[level]}
            </Text>
          </Box>
        ))}
      </Box>
    </ModalContainer>
  );
};

interface CopilotAuthModalProps {
  userCode: string | null;
  verificationUri: string | null;
  status: "waiting" | "polling" | "success" | "error";
  errorMessage?: string;
}

export const CopilotAuthModal: React.FC<CopilotAuthModalProps> = ({
  userCode,
  verificationUri,
  status,
  errorMessage,
}) => {
  return (
    <ModalContainer
      title="GitHub Copilot Authentication"
      width={60}
      borderColor={
        status === "error" ? "red" : status === "success" ? "green" : "magenta"
      }
      footer={
        status === "success" ? "Press any key to continue" : "ESC to cancel"
      }
    >
      <Box flexDirection="column" gap={1}>
        {status === "waiting" && (
          <>
            <Box gap={1}>
              <Spinner type="dots" />
              <Text>Requesting authorization code...</Text>
            </Box>
          </>
        )}

        {status === "polling" && userCode && verificationUri && (
          <>
            <Text color="gray">
              To authenticate with GitHub Copilot, visit:
            </Text>
            <Box marginY={1}>
              <Text color="cyan" bold>
                {verificationUri}
              </Text>
            </Box>
            <Text color="gray">And enter this code:</Text>
            <Box marginY={1}>
              <Box
                borderStyle="double"
                borderColor="magenta"
                paddingX={3}
                paddingY={1}
              >
                <Text color="magenta" bold>
                  {userCode}
                </Text>
              </Box>
            </Box>
            <Box gap={1}>
              <Spinner type="dots" />
              <Text color="gray" dimColor>
                Waiting for authorization...
              </Text>
            </Box>
          </>
        )}

        {status === "success" && (
          <>
            <Text color="green" bold>
              {figures.tick} Authentication successful!
            </Text>
            <Text color="gray">You can now use GitHub Copilot models.</Text>
          </>
        )}

        {status === "error" && (
          <>
            <Text color="red" bold>
              {figures.cross} Authentication failed
            </Text>
            <Text color="gray">{errorMessage ?? "Unknown error"}</Text>
          </>
        )}
      </Box>
    </ModalContainer>
  );
};
