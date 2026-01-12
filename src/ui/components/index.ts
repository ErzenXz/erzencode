/**
 * UI Components index.
 * Re-exports all components for easy importing.
 */

// Core components
export { UserMessage } from "./UserMessage.js";
export { AssistantMessage } from "./AssistantMessage.js";
export { ToolActivity } from "./ToolActivity.js";
export { ChatFeed } from "./ChatFeed.js";
export { InputBox } from "./InputBox.js";
export { StatusBar } from "./StatusBar.js";
export { Header } from "./Header.js";
export { WelcomeScreen } from "./WelcomeScreen.js";

// Modal components
export {
  ModalContainer,
  HelpModal,
  ThemeModal,
  ThinkingModal,
  ModelsModal,
  SessionsModal,
  ProviderModal,
  SettingsModal,
  ApiKeyModal,
  CopilotAuthModal,
  IndexModal,
  SearchModal,
} from "./Modals.js";

// Chat components
export {
  ToolDisplay,
  ToolGroup,
  MessageRenderer,
  TOOL_DISPLAY,
  formatToolInputSummary,
  formatToolOutput,
} from "./chat/index.js";

// Input components
export { Autocomplete, ModeSelector } from "./input/index.js";
