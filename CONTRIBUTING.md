# Contributing to erzencode

## Architecture Overview

```
erzencode/
├── src/
│   ├── cli.ts              # Main entry point (Commander.js CLI)
│   ├── ai-agent.ts         # AI agent with tool execution
│   ├── ai-provider.ts      # Provider abstraction (OpenAI, Anthropic, etc.)
│   ├── ai-middleware.ts    # Request/response middleware
│   ├── config.ts           # Configuration management
│   ├── tools-standalone.ts # File system & shell tools
│   ├── models.ts           # Model definitions & capabilities
│   ├── markdown.ts         # Terminal markdown rendering
│   ├── themes.ts           # UI color themes
│   ├── subagents.ts        # Specialized sub-agents
│   ├── compaction.ts       # Context compaction for long conversations
│   ├── copilot-auth.ts     # GitHub Copilot authentication
│   │
│   ├── ui/                 # Terminal UI (Ink/React)
│   │   ├── index.ts        # UI exports
│   │   ├── App.tsx         # Main Ink application
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React hooks
│   │   ├── types.ts        # TypeScript types
│   │   └── utils.ts        # UI utilities
│   │
│   ├── web-ui/             # Browser UI (Vite/React)
│   │   ├── App.tsx         # Main React app
│   │   ├── components/     # UI components
│   │   ├── hooks/          # React hooks
│   │   └── styles/         # CSS/Tailwind
│   │
│   ├── web-ui-new.ts       # HTTP server for web UI
│   └── web-templates/      # HTML templates for web modes
│
├── dist/                   # Built output
├── package.json
├── tsconfig.json
├── vite.config.ts          # Vite config for web UI
└── tailwind.config.cjs     # Tailwind config
```

## How It Works

### Entry Point Flow

```
npm install -g erzencode
erzencode
    │
    ▼
cli.ts (Commander.js)
    │
    ├── Default: runErzenCodeUI() → Ink TUI
    ├── /web command → startWebUI() → Browser
    └── run/chat commands → Direct AI interaction
```

### 1. CLI Layer (`cli.ts`)

The main entry point uses Commander.js to parse arguments and route to the appropriate mode:

- **Default**: Launches the Ink-based terminal UI
- **`run <task>`**: Single task execution
- **`chat`**: Legacy readline-based chat
- **`init`**: Interactive configuration
- **`config`**: Show/edit configuration

### 2. Terminal UI (`ui/App.tsx`)

An Ink (React for terminals) application providing:

- Real-time streaming responses
- Tool execution visualization
- Session management
- Slash command system
- Keyboard shortcuts

Key components:
- `ChatFeed` - Message display with streaming
- `InputBox` - Command input with history
- `ToolActivity` - Live tool execution status
- `Modals` - Settings, model selection, etc.

### 3. AI Agent (`ai-agent.ts`)

The core agent that:
- Manages conversation history
- Executes tool calls
- Handles streaming responses
- Supports multiple modes (agent/ask/plan)

```typescript
const agent = createAIAgent({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  mode: "agent",
  workspaceRoot: process.cwd(),
});

for await (const event of agent.stream(messages)) {
  // Handle text-delta, tool-call, tool-result, etc.
}
```

### 4. Tools (`tools-standalone.ts`)

File system and shell operations:

| Tool | Purpose |
|------|---------|
| `read_file` | Read file contents |
| `write_file` | Create/overwrite files |
| `edit_file` | Surgical edits with search/replace |
| `list_directory` | List directory contents |
| `file_tree` | Project structure |
| `execute_command` | Run shell commands |
| `search_files` | Grep/ripgrep search |
| `git_status` | Git status |
| `git_diff` | Git diffs |

### 5. Web UI (`web-ui-new.ts` + `web-ui/`)

Two-part web interface:

1. **HTTP Server** (`web-ui-new.ts`): Serves the React app and handles API requests
2. **React App** (`web-ui/`): Browser-based IDE with:
   - Monaco editor
   - File tree
   - Terminal (xterm.js)
   - Chat interface

Modes:
- **web**: Full IDE experience
- **vibe**: Minimal chat-focused UI

### 6. Configuration (`config.ts`)

Manages:
- Provider/model selection
- API keys (from env vars)
- User preferences
- Session persistence

Config locations:
- macOS: `~/Library/Application Support/erzencode/`
- Linux: `~/.config/erzencode/`
- Windows: `%APPDATA%\erzencode\`

## Development

### Setup

```bash
git clone https://github.com/ErzenXz/erzencode.git
cd erzencode
pnpm install
```

### Commands

```bash
# Development (runs with tsx)
pnpm dev

# Build
pnpm build

# Run built version
pnpm start

# Web UI development (hot reload)
pnpm dev:web-ui

# Clean build artifacts
pnpm clean
```

### Project Structure Tips

1. **Adding a new tool**: Edit `tools-standalone.ts`, add to the tools array
2. **Adding a new provider**: Edit `ai-provider.ts` and `models.ts`
3. **Adding a slash command**: Edit `ui/App.tsx` in the command handler
4. **Changing UI components**: Edit files in `ui/components/`
5. **Changing web UI**: Edit files in `web-ui/`

### Testing Changes

```bash
# Build and link globally
pnpm build
pnpm link --global

# Test in any directory
cd ~/some-project
erzencode
```

## Code Style

- TypeScript strict mode
- ESM modules (`"type": "module"`)
- Functional React components with hooks
- Minimal dependencies where possible

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system changes |
| `ci` | CI/CD changes |
| `chore` | Other changes |

### Examples

```bash
feat(cli): add support for custom themes
fix(web-ui): resolve memory leak in terminal component
docs(readme): update installation instructions
test(ai-agent): add unit tests for streaming responses
ci(github): add semantic release automation
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main` or `master`
3. Make your changes following commit message guidelines
4. Run `pnpm build` to ensure it compiles
5. Test manually with `pnpm dev`
6. Submit PR with conventional commit title (e.g., `feat(cli): add dark mode support`)

## Questions?

Open an issue on GitHub or reach out to [@erzenkrasniqi](https://github.com/erzenkrasniqi).
