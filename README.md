# erzencode

> Your AI-powered coding assistant in the terminal

[![npm version](https://img.shields.io/npm/v/erzencode.svg)](https://www.npmjs.com/package/erzencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install -g erzencode
```

## Quick Start

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...

# Run in any project
cd your-project
erzencode
```

That's it! You're now pair programming with AI.

## What Can It Do?

Ask erzencode to help with any coding task:

```
> Create a REST API with Express and TypeScript
> Fix the failing tests in src/utils.test.ts
> Refactor this component to use React hooks
> Review my changes and suggest improvements
> Search the codebase for authentication logic
```

erzencode can:
- **Read & write files** in your project
- **Run commands** (npm, git, tests, etc.)
- **Search** your codebase
- **Create** new projects from scratch
- **Debug** and fix issues

## Modes

| Mode | What it does |
|------|--------------|
| `agent` | Full access - reads, writes, executes (default) |
| `ask` | Read-only - answers questions, gives guidance |
| `plan` | Planning mode - analyzes and suggests approach |

## Commands

Type these in the chat:

| Command | What it does |
|---------|--------------|
| `/help` | Show all commands |
| `/models` | List available models |
| `/provider <name>` | Switch provider (openai, anthropic, etc.) |
| `/model <id>` | Switch model |
| `/new` | Start fresh session |
| `/web` | Open web UI in browser |
| `/exit` | Quit |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Exit |
| `Ctrl+N` | New session |
| `Ctrl+L` | Clear screen |
| `↑/↓` | Command history |
| `Tab` | Autocomplete commands |

## Providers

**First run?** erzencode will ask you to set up your API key interactively:

```bash
erzencode
# → Select provider
# → Enter API key (saved securely to config)
# → Start coding!
```

Or use environment variables:

| Provider | Environment Variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| xAI (Grok) | `XAI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Groq | `GROQ_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Ollama | (no key needed) |

You can also run `erzencode init` anytime to reconfigure.

## Configuration

Config is stored at:
- **macOS**: `~/Library/Application Support/erzencode/config.json`
- **Linux**: `~/.config/erzencode/config.json`
- **Windows**: `%APPDATA%\erzencode\config.json`

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "mode": "agent"
}
```

Or run `erzencode init` to configure interactively.

## Web UI

erzencode includes a beautiful web interface:

```bash
erzencode
# then type /web in the chat
```

This opens a browser-based UI with:
- File explorer
- Code editor
- Terminal
- Chat interface

## Safety

- Dangerous commands are blocked (e.g., `rm -rf /`)
- Commands timeout after 30 seconds
- All file operations are within your project directory

## Development

```bash
# Clone and install
git clone https://github.com/ErzenXz/erzencode.git
cd erzencode
pnpm install

# Run in development mode (no build needed)
pnpm dev

# Build and link globally for testing
pnpm link:global

# Now you can use erzencode anywhere
erzencode

# Unlink to test published version instead
pnpm unlink:global
npm install -g erzencode
```

## License

MIT © [Erzen Krasniqi](https://github.com/erzenkrasniqi)
