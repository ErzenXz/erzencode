# Design Document: Codebase Refactoring

## Overview

This design document outlines the architectural changes needed to refactor the erzencode codebase for better separation of concerns, cleaner code, and improved maintainability. The refactoring focuses on two main UI systems: the Terminal UI (Ink/React) and the Web UI (React).

The key principles guiding this refactoring are:
- **Single Responsibility**: Each module/component does one thing well
- **Separation of Concerns**: UI, state, and business logic are separated
- **Testability**: Logic is extracted into pure functions that can be unit tested
- **Composability**: Small, focused components that compose together

## Architecture

### Current State Analysis

The current codebase has several architectural issues:

1. **Monolithic App Component**: `src/ui/App.tsx` is ~2400 lines with state management, keyboard handling, command processing, and rendering all mixed together
2. **Large Components**: `ChatFeed.tsx` (~500 lines) contains rendering logic, formatting logic, and tool display logic
3. **Mixed Concerns**: Business logic (tool formatting, command handling) is embedded in React components
4. **Inconsistent Structure**: Web UI and Terminal UI have different organizational patterns

### Target Architecture

```
src/
├── ui/                          # Terminal UI (Ink)
│   ├── App.tsx                  # Slim composition component (~150 lines)
│   ├── types/                   # Type definitions
│   │   ├── index.ts
│   │   ├── messages.ts
│   │   ├── sessions.ts
│   │   ├── tools.ts
│   │   └── ui-state.ts
│   ├── hooks/                   # Custom React hooks
│   │   ├── index.ts
│   │   ├── useSession.ts
│   │   ├── useInput.ts
│   │   ├── useModal.ts
│   │   ├── useAgentConfig.ts
│   │   └── useKeyboard.ts
│   ├── services/                # Business logic (pure functions)
│   │   ├── index.ts
│   │   ├── command-handler.ts
│   │   ├── session-service.ts
│   │   └── tool-formatters.ts
│   ├── components/              # UI components
│   │   ├── index.ts
│   │   ├── chat/
│   │   │   ├── ChatFeed.tsx
│   │   │   ├── MessageRenderer.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   └── AssistantMessage.tsx
│   │   ├── tools/
│   │   │   ├── ToolDisplay.tsx
│   │   │   ├── ToolGroup.tsx
│   │   │   └── ToolOutput.tsx
│   │   ├── modals/
│   │   │   ├── ModalContainer.tsx
│   │   │   ├── HelpModal.tsx
│   │   │   ├── ThemeModal.tsx
│   │   │   ├── ModelsModal.tsx
│   │   │   ├── SessionsModal.tsx
│   │   │   ├── ProviderModal.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ApiKeyModal.tsx
│   │   │   ├── ThinkingModal.tsx
│   │   │   └── CopilotAuthModal.tsx
│   │   ├── input/
│   │   │   ├── InputBox.tsx
│   │   │   └── Autocomplete.tsx
│   │   ├── Header.tsx
│   │   ├── StatusBar.tsx
│   │   ├── ContextSidebar.tsx
│   │   └── WelcomeScreen.tsx
│   └── utils/                   # Utility functions
│       ├── index.ts
│       ├── text-utils.ts
│       └── format-utils.ts
│
├── web-ui/                      # Web UI (React)
│   ├── App.tsx                  # Slim composition component
│   ├── types/
│   │   └── index.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useConfig.ts
│   │   ├── useChat.ts
│   │   └── useFileSystem.ts
│   ├── components/
│   │   ├── panels/              # Main layout panels
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── EditorPanel.tsx
│   │   │   ├── FileTreePanel.tsx
│   │   │   └── TerminalPanel.tsx
│   │   ├── ai-elements/         # AI chat components
│   │   ├── editor/              # Editor components
│   │   ├── files/               # File tree components
│   │   ├── layout/              # Layout components
│   │   ├── settings/            # Settings components
│   │   ├── terminal/            # Terminal components
│   │   └── ui/                  # Base UI components
│   └── lib/
│       ├── utils.ts
│       └── file-system.ts
│
└── shared/                      # Shared utilities
    ├── types.ts
    └── result.ts                # Result type for error handling
```

## Components and Interfaces

### Terminal UI Hooks

#### useSession Hook

```typescript
interface UseSessionReturn {
  sessions: SessionState[];
  currentSession: SessionState;
  currentSessionId: string;
  createSession: (name?: string) => void;
  switchSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<SessionState>) => void;
  deleteSession: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
}

function useSession(initialWorkingDirectory: string): UseSessionReturn;
```

#### useInput Hook

```typescript
interface UseInputReturn {
  value: string;
  cursorIndex: number;
  setValue: (value: string) => void;
  setCursorIndex: (index: number) => void;
  insertText: (text: string) => void;
  deleteChar: (direction: 'forward' | 'backward') => void;
  moveCursor: (direction: 'left' | 'right' | 'start' | 'end') => void;
  clear: () => void;
  history: string[];
  historyIndex: number;
  navigateHistory: (direction: 'up' | 'down') => void;
}

function useInput(): UseInputReturn;
```

#### useModal Hook

```typescript
interface UseModalReturn {
  activeModal: ModalType;
  selectionIndex: number;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setSelectionIndex: (index: number) => void;
  navigateSelection: (direction: 'up' | 'down') => void;
  selectCurrent: () => void;
}

function useModal(): UseModalReturn;
```

#### useAgentConfig Hook

```typescript
interface UseAgentConfigReturn {
  provider: ProviderType;
  model: string;
  mode: CodingAgentMode;
  thinking: ThinkingLevel;
  setProvider: (provider: ProviderType) => void;
  setModel: (model: string) => void;
  setMode: (mode: CodingAgentMode) => void;
  setThinking: (level: ThinkingLevel) => void;
  supportsThinking: boolean;
  availableModels: string[];
  isLoadingModels: boolean;
}

function useAgentConfig(initialConfig: AgentConfig): UseAgentConfigReturn;
```

### Service Modules

#### Command Handler Service

```typescript
interface CommandResult {
  success: boolean;
  message?: string;
  action?: 'openModal' | 'setMode' | 'navigate' | 'exit' | 'none';
  payload?: unknown;
}

interface CommandHandler {
  parseCommand: (input: string) => { command: string; args: string[] } | null;
  executeCommand: (command: string, args: string[], context: CommandContext) => CommandResult;
  getCompletions: (partial: string) => SlashCommand[];
}

function createCommandHandler(): CommandHandler;
```

#### Tool Formatters Service

```typescript
interface ToolFormatter {
  formatInputSummary: (name: string, args: Record<string, unknown>) => string;
  formatOutput: (name: string, output: string) => FormattedOutput;
  getDisplayInfo: (name: string) => { label: string; icon: string };
}

interface FormattedOutput {
  lines: string[];
  isError: boolean;
  markdown?: string;
}

function createToolFormatter(workspaceRoot?: string): ToolFormatter;
```

#### Session Service

```typescript
interface SessionService {
  createSession: (workingDirectory: string, name?: string) => SessionState;
  serializeSession: (session: SessionState) => string;
  deserializeSession: (data: string) => SessionState;
  mergeMessages: (existing: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[];
}

function createSessionService(): SessionService;
```

### Keyboard Handler Module

```typescript
interface KeyboardContext {
  stage: Stage;
  activeModal: ModalType;
  isThinking: boolean;
  showAutocomplete: boolean;
  bashApprovalPrompt: BashApprovalPrompt | null;
}

interface KeyboardAction {
  type: 'input' | 'modal' | 'navigation' | 'command' | 'none';
  action: string;
  payload?: unknown;
}

interface KeyboardHandler {
  handleKey: (key: string, modifiers: KeyModifiers, context: KeyboardContext) => KeyboardAction;
}

function createKeyboardHandler(): KeyboardHandler;
```

### Component Interfaces

#### ChatFeed Component (Refactored)

```typescript
interface ChatFeedProps {
  messages: ChatMessage[];
  width: number;
  height: number;
  scrollOffset: number;
  workingDirectory: string;
  onLineCountChange?: (count: number) => void;
}

// Delegates to:
// - MessageRenderer for rendering individual messages
// - ToolDisplay for rendering tool calls
// - Uses tool-formatters service for formatting
```

#### ToolDisplay Component

```typescript
interface ToolDisplayProps {
  tool: ToolPart;
  workspaceRoot?: string;
}

interface ToolGroupProps {
  tools: ToolPart[];
  workspaceRoot?: string;
}
```

## Data Models

### Message Types

```typescript
/**
 * Represents a thinking/reasoning part of an assistant message
 */
interface ThinkingPart {
  type: 'thinking';
  content: string;
}

/**
 * Represents an action description part
 */
interface ActionPart {
  type: 'action';
  content: string;
}

/**
 * Represents a tool invocation part
 */
interface ToolPart {
  type: 'tool';
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  output?: string;
  status: 'running' | 'done' | 'error';
}

/**
 * Represents a text content part
 */
interface TextPart {
  type: 'text';
  content: string;
}

/**
 * Represents an error part
 */
interface ErrorPart {
  type: 'error';
  content: string;
}

type MessagePart = ThinkingPart | ActionPart | ToolPart | TextPart | ErrorPart;

/**
 * Represents a chat message in the conversation
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  parts?: MessagePart[];
}
```

### Session Types

```typescript
/**
 * Represents a chat session with its state
 */
interface SessionState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;
  messages: ChatMessage[];
  provider: ProviderType;
  model: string;
}
```

### Result Type for Error Handling

```typescript
/**
 * Represents the result of an operation that may fail
 */
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Helper functions for working with Result types
 */
const Result = {
  ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),
  err: <E>(error: E): Result<never, E> => ({ ok: false, error }),
  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
    result.ok ? Result.ok(fn(result.value)) : result,
  flatMap: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> =>
    result.ok ? fn(result.value) : result,
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Keyboard Input Routing

*For any* keyboard input and context state, the keyboard handler SHALL route the input to the correct handler based on the current context (modal open, autocomplete visible, thinking state).

**Validates: Requirements 2.2, 2.3**

### Property 2: Tool Formatter Purity

*For any* tool name and arguments, calling the tool formatter with the same inputs SHALL always produce the same output (pure function behavior).

**Validates: Requirements 3.5, 7.3**

### Property 3: Service Result Types

*For any* service function that can fail, the function SHALL return a Result type that explicitly indicates success or failure, never throwing exceptions for expected error cases.

**Validates: Requirements 8.1**

### Property 4: Utility Function Purity

*For any* utility function in the utils modules, calling the function with the same inputs SHALL always produce the same output with no side effects.

**Validates: Requirements 7.3**

## Error Handling

### Service Layer Errors

All service functions that can fail will return `Result<T, E>` types:

```typescript
// Example: Command handler
function executeCommand(command: string, args: string[]): Result<CommandResult, CommandError> {
  if (!isValidCommand(command)) {
    return Result.err({ type: 'invalid_command', message: `Unknown command: ${command}` });
  }
  // ... execute command
  return Result.ok({ success: true, message: 'Command executed' });
}
```

### Component Layer Errors

Components will use error boundaries and display user-friendly messages:

```typescript
// Error display in components
{error && (
  <Box>
    <Text color="red">{figures.cross} {error.message}</Text>
  </Box>
)}
```

### Error Types

```typescript
interface CommandError {
  type: 'invalid_command' | 'missing_args' | 'execution_failed';
  message: string;
}

interface SessionError {
  type: 'not_found' | 'invalid_state' | 'serialization_failed';
  message: string;
}

interface ToolFormatError {
  type: 'unknown_tool' | 'invalid_output';
  message: string;
}
```

## Testing Strategy

### Unit Tests

Unit tests will focus on:
- Service module functions (command handler, tool formatters, session service)
- Utility functions (text formatting, time formatting)
- Hook logic (using React Testing Library)

### Property-Based Tests

Property-based tests will validate:
- **Property 1**: Keyboard routing consistency
- **Property 2**: Tool formatter purity
- **Property 3**: Result type usage in services
- **Property 4**: Utility function purity

Testing framework: **fast-check** for property-based testing in TypeScript

Configuration:
- Minimum 100 iterations per property test
- Each test tagged with: **Feature: codebase-refactoring, Property N: [property description]**

### Integration Tests

Integration tests will verify:
- Component composition works correctly
- Hooks integrate properly with components
- Services are called correctly from hooks

### Test File Organization

```
src/
├── ui/
│   ├── hooks/
│   │   └── __tests__/
│   │       ├── useSession.test.ts
│   │       ├── useInput.test.ts
│   │       └── useModal.test.ts
│   ├── services/
│   │   └── __tests__/
│   │       ├── command-handler.test.ts
│   │       ├── tool-formatters.test.ts
│   │       └── session-service.test.ts
│   └── utils/
│       └── __tests__/
│           ├── text-utils.test.ts
│           └── format-utils.test.ts
```

