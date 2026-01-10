# Erzencode - AI Coding CLI

A modern, AI-powered coding assistant command-line interface built with `@ai-infra/sdk` and Ink for beautiful terminal UIs.

## Features

- **Modern Terminal UI**: Beautiful Ink-based interface with live streaming, thinking indicators, and tool execution display
- **Multi-Session Support**: Create, switch, rename, and persist multiple coding sessions
- **Session Persistence**: Sessions are saved to disk and restored on restart
- **Command History**: Navigate through previous commands with up/down arrows
- **Tab Completion**: Tab-complete slash commands for faster navigation
- **Cross-Platform Config**: Works on Windows, macOS, and Linux with proper config paths
- **Dynamic Model Loading**: Fetches available models from providers when possible
- **Slash Commands**: Rich command system for navigation and configuration
- **Live Tool Execution**: See tools being called in real-time with status indicators
- **Streaming Responses**: Real-time AI response streaming
- **Extended Thinking**: Support for extended thinking/reasoning with visual display
- **Multiple Providers**: Support for OpenAI, Anthropic, Ollama, OpenRouter, Groq, and more

## Installation

```bash
# From the ai-infra monorepo root
pnpm install && pnpm build

# Navigate to the CLI
cd examples/coding-cli

# Link globally
pnpm link --global

# Now run from any folder
erzencode
```

## Quick Start

```bash
# Set your API key
export OPENAI_API_KEY=sk-...

# Run erzencode - opens the interactive UI
erzencode

# Or configure first
erzencode init
```

## Usage

### Interactive Mode (Default)

Simply run `erzencode` in any project directory to start the interactive UI:

```bash
cd your-project
erzencode
```

The UI shows:

- Current provider, model, and session info
- Live streaming responses
- Tool execution with spinners
- Slash command hints

### Slash Commands

| Command            | Aliases       | Description                      |
| ------------------ | ------------- | -------------------------------- |
| `/help`            | `/h`, `/?`    | Show help and available commands |
| `/models`          | `/m`          | Show available models            |
| `/sessions`        | `/s`          | Show all sessions                |
| `/tools`           | `/t`          | Show available tools             |
| `/settings`        |               | Show current settings            |
| `/cwd`             |               | Show current working directory   |
| `/new [name]`      | `/n`          | Create a new session             |
| `/use <id>`        |               | Switch to a session              |
| `/delete <id>`     | `/del`        | Delete a session                 |
| `/rename <name>`   |               | Rename current session           |
| `/reset`           | `/r`          | Reset current conversation       |
| `/clear`           | `/c`          | Clear messages                   |
| `/model <id>`      |               | Set model                        |
| `/provider <name>` |               | Set provider                     |
| `/save`            |               | Save configuration               |
| `/back`            | `/b`          | Return to chat                   |
| `/exit`            | `/quit`, `/q` | Exit erzencode                   |

### Keyboard Shortcuts

| Shortcut  | Action                   |
| --------- | ------------------------ |
| `Ctrl+C`  | Exit                     |
| `Ctrl+S`  | Save config              |
| `Ctrl+R`  | Reset session            |
| `Ctrl+L`  | Clear messages           |
| `Ctrl+N`  | New session              |
| `Up/Down` | Navigate command history |
| `Tab`     | Complete slash commands  |

### CLI Commands

```bash
# Run a single task
erzencode run "Create a hello world TypeScript file"

# Legacy chat mode (readline-based)
erzencode chat

# Show configuration
erzencode config

# List available models
erzencode models [provider]

# List providers
erzencode providers

# Initialize/update config
erzencode init
```

## Configuration

### Config Locations

| Platform | Config Path                                           |
| -------- | ----------------------------------------------------- |
| Windows  | `%APPDATA%\erzencode\config.json`                     |
| macOS    | `~/Library/Application Support/erzencode/config.json` |
| Linux    | `~/.config/erzencode/config.json`                     |

### Config Options

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "mode": "agent",
  "thinkingLevel": "off",
  "renderer": "markdown",
  "workspaceRoot": "/optional/fixed/path",
  "lockWorkspace": false
}
```

## Providers

| Provider    | Environment Variable        |
| ----------- | --------------------------- |
| OpenAI      | `OPENAI_API_KEY`            |
| Anthropic   | `ANTHROPIC_API_KEY`         |
| Ollama      | `OLLAMA_API_KEY` (or blank) |
| OpenRouter  | `OPENROUTER_API_KEY`        |
| Together AI | `TOGETHER_API_KEY`          |
| Fireworks   | `FIREWORKS_API_KEY`         |
| xAI (Grok)  | `XAI_API_KEY`               |
| Perplexity  | `PERPLEXITY_API_KEY`        |
| Groq        | `GROQ_API_KEY`              |
| Mistral     | `MISTRAL_API_KEY`           |
| Cohere      | `COHERE_API_KEY`            |
| DeepSeek    | `DEEPSEEK_API_KEY`          |

### Optional Integrations

```bash
# Exa for web/code search
export EXA_API_KEY=...

# MCP server integration
export MCP_SERVER_URL=http://localhost:3001/mcp
export MCP_AUTH_TOKEN=...
```

## Modes

- **agent**: Full tool access - read, write, execute commands
- **ask**: Read-only - answer questions, provide guidance
- **review**: Analysis mode - code review and recommendations

## Thinking Levels

Control the AI's reasoning depth:

- **off**: No extended thinking
- **low**: Light reasoning (1K tokens)
- **medium**: Moderate reasoning (4K tokens)
- **high**: Deep reasoning (16K tokens)

## Available Tools

| Tool               | Description                |
| ------------------ | -------------------------- |
| `read_file`        | Read file contents         |
| `read_files`       | Read multiple files        |
| `write_file`       | Create or overwrite files  |
| `edit_file`        | Make targeted edits        |
| `apply_patch`      | Apply unified diff patches |
| `list_directory`   | List files and directories |
| `file_tree`        | List project structure     |
| `execute_command`  | Run shell commands         |
| `git_status`       | Git status summary         |
| `git_diff`         | Git diffs                  |
| `search_files`     | Search for patterns        |
| `create_directory` | Create directories         |
| `delete_file`      | Delete files               |
| `exa_code_context` | Code context from Exa      |
| `exa_search`       | Web search via Exa         |
| `mcp_request`      | Call MCP servers           |

## Examples

### Create a project

```
> Create a new Express.js API with TypeScript
```

### Debug and fix

```
> Run npm test, analyze failures, and fix them
```

### Refactor code

```
> Read src/utils.ts and refactor to use async/await
```

### Code review

```
> Review the changes in src/api.ts and suggest improvements
```

## Safety

- Dangerous commands (like `rm -rf /`) are blocked
- Command execution has 30-second timeouts
- Output is limited to prevent memory issues

## Development

```bash
# Development mode
pnpm dev

# Build
pnpm build

# Clean
pnpm clean
```

## Architecture

```
examples/coding-cli/
├── src/
│   ├── cli.ts      # CLI entry point
│   ├── ui.tsx      # Ink UI components
│   ├── agent.ts    # AI agent configuration
│   ├── config.ts   # Configuration management
│   ├── tools.ts    # File system tools
│   └── markdown.ts # Terminal markdown rendering
├── package.json
└── README.md
```

## License

MIT
