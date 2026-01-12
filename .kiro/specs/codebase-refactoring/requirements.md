# Requirements Document

## Introduction

This document defines the requirements for refactoring the erzencode codebase to achieve better separation of concerns, cleaner code architecture, and improved maintainability. The codebase consists of two main UI systems: a terminal-based UI (using Ink/React) and a web-based UI (using React). Both need structural improvements to follow best practices.

## Glossary

- **Terminal_UI**: The Ink-based terminal user interface located in `src/ui/`
- **Web_UI**: The browser-based React user interface located in `src/web-ui/`
- **App_Component**: The main application component that currently contains excessive logic
- **Hook**: A React custom hook that encapsulates reusable stateful logic
- **Service**: A module that handles business logic separate from UI components
- **State_Manager**: A centralized system for managing application state
- **Component**: A React component responsible for rendering UI elements
- **Utility**: A pure function that performs a specific transformation or calculation

## Requirements

### Requirement 1: Extract State Management from App Component

**User Story:** As a developer, I want application state to be managed in dedicated hooks, so that the App component is focused on composition rather than state logic.

#### Acceptance Criteria

1. WHEN the Terminal_UI App component is loaded, THE State_Manager SHALL provide session state through a dedicated `useSession` hook
2. WHEN the Terminal_UI App component is loaded, THE State_Manager SHALL provide input state through a dedicated `useInput` hook
3. WHEN the Terminal_UI App component is loaded, THE State_Manager SHALL provide modal state through a dedicated `useModal` hook
4. WHEN the Terminal_UI App component is loaded, THE State_Manager SHALL provide agent configuration through a dedicated `useAgentConfig` hook
5. THE App_Component SHALL contain fewer than 200 lines of code after refactoring

### Requirement 2: Extract Keyboard Handling Logic

**User Story:** As a developer, I want keyboard handling to be in a dedicated module, so that input processing is testable and maintainable.

#### Acceptance Criteria

1. WHEN keyboard input is received, THE Terminal_UI SHALL delegate to a dedicated keyboard handler module
2. WHEN modal navigation keys are pressed, THE keyboard handler SHALL route to modal-specific handlers
3. WHEN text editing keys are pressed, THE keyboard handler SHALL route to input-specific handlers
4. THE keyboard handler module SHALL be independent of React component lifecycle

### Requirement 3: Split Large Components into Smaller Units

**User Story:** As a developer, I want UI components to have single responsibilities, so that they are easier to understand and test.

#### Acceptance Criteria

1. WHEN rendering the chat feed, THE ChatFeed component SHALL delegate tool rendering to a dedicated ToolDisplay component
2. WHEN rendering the chat feed, THE ChatFeed component SHALL delegate message rendering to dedicated MessageRenderer components
3. WHEN rendering modals, THE Modals module SHALL export each modal as a separate file
4. THE ChatFeed component SHALL contain fewer than 200 lines of code after refactoring
5. WHEN rendering tool output, THE ToolDisplay component SHALL use dedicated formatters for each tool type

### Requirement 4: Create Dedicated Service Modules

**User Story:** As a developer, I want business logic separated from UI components, so that logic can be reused and tested independently.

#### Acceptance Criteria

1. WHEN formatting tool output, THE Terminal_UI SHALL use a dedicated `tool-formatters` service module
2. WHEN managing sessions, THE Terminal_UI SHALL use a dedicated `session-service` module
3. WHEN handling slash commands, THE Terminal_UI SHALL use a dedicated `command-handler` service module
4. THE service modules SHALL be pure functions without React dependencies

### Requirement 5: Organize Web UI Components

**User Story:** As a developer, I want the Web UI components to follow a consistent folder structure, so that related components are easy to locate.

#### Acceptance Criteria

1. WHEN organizing Web_UI components, THE folder structure SHALL group components by feature domain
2. WHEN a component exceeds 150 lines, THE component SHALL be split into smaller sub-components
3. THE Web_UI App component SHALL delegate panel rendering to dedicated panel components
4. WHEN rendering the chat panel, THE Web_UI SHALL use a dedicated ChatPanel component

### Requirement 6: Improve Type Definitions

**User Story:** As a developer, I want comprehensive type definitions, so that the codebase has strong type safety.

#### Acceptance Criteria

1. WHEN defining types, THE types module SHALL organize types by domain (messages, sessions, tools, UI state)
2. WHEN a type is used across multiple modules, THE type SHALL be exported from a central types file
3. THE type definitions SHALL include JSDoc comments for complex types
4. IF a function parameter type is `any`, THEN THE type SHALL be replaced with a specific type definition

### Requirement 7: Extract Utility Functions

**User Story:** As a developer, I want utility functions in dedicated modules, so that they can be reused and tested.

#### Acceptance Criteria

1. WHEN formatting text for display, THE Terminal_UI SHALL use utilities from a dedicated `text-utils` module
2. WHEN formatting tokens or time, THE Terminal_UI SHALL use utilities from a dedicated `format-utils` module
3. THE utility modules SHALL contain only pure functions
4. THE utility functions SHALL have comprehensive JSDoc documentation

### Requirement 8: Implement Consistent Error Handling

**User Story:** As a developer, I want consistent error handling patterns, so that errors are handled predictably.

#### Acceptance Criteria

1. WHEN an error occurs in a service module, THE service SHALL return a typed Result object
2. WHEN an error occurs in a React component, THE component SHALL display user-friendly error messages
3. THE error handling pattern SHALL be consistent across Terminal_UI and Web_UI

