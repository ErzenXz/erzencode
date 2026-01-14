/**
 * Central export point for all Terminal UI hooks.
 * Import hooks from this file for consistency.
 */

// Keyboard handling
export { useKeyboard } from "./useKeyboard.js";

// Input state management
export {
  useInputState,
  type UseInputStateReturn,
} from "./useInputState.js";

// Modal state management
export {
  useModalState,
  type UseModalStateReturn,
} from "./useModalState.js";

// Session state management
export {
  useSessionState,
  type UseSessionStateReturn,
} from "./useSessionState.js";

// Agent configuration
export {
  useAgentConfig,
  type AgentConfig,
  type UseAgentConfigReturn,
} from "./useAgentConfig.js";

// Agent streaming
export {
  useAgentStream,
  type AgentStreamConfig,
  type StreamState,
  type UseAgentStreamReturn,
} from "./useAgentStream.js";
