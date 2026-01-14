# erzencode

> Your AI-powered coding assistant in the terminal

[![npm version](https://img.shields.io/npm/v/erzencode.svg)](https://www.npmjs.com/package/erzencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/erzencode.svg)](https://nodejs.org)
[![Commitlint](https://img.shields.io/badge/commitlint-conventional-blue)](https://commitlint.js.org)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23E52961.svg)](https://conventionalcommits.org)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![CI](https://github.com/ErzenXz/erzencode/actions/workflows/ci.yml/badge.svg)](https://github.com/ErzenXz/erzencode/actions/workflows/ci.yml)

## Features

- **Multiple AI Providers**: Support for Anthropic, OpenAI, Google, xAI, Mistral, OpenRouter, Groq, DeepSeek, and Ollama
- **Terminal UI**: Beautiful terminal interface with streaming responses
- **Web UI**: Browser-based IDE with Monaco editor and terminal
- **VSCode Extension**: Use ErzenCode directly in VSCode with side panel chat [↗](packages/vscode-extension/)
- **File Operations**: Read, write, edit, search, and manage files
- **Shell Integration**: Run commands with approval prompts
- **Git Support**: View status, diffs, and manage repositories
- **Multiple Modes**: agent, ask, and plan modes for different workflows
- **Session Management**: Save and resume conversations

## Install

### CLI

```bash
npm install -g erzencode
pnpm add -g erzencode
bun add -g erzencode
```

### VSCode Extension

1. Download [erzencode-vscode-0.3.0.vsix](packages/vscode-extension/erzencode-vscode-0.3.0.vsix)
2. Install: `code --install-extension erzencode-vscode-0.3.0.vsix`
3. Or see [VSCode Extension README](packages/vscode-extension/README.md) for details

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

## Contributing

We love contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

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

## Project Status

This project is under active development. See [CHANGELOG.md](CHANGELOG.md) for recent changes.

## License

MIT &copy; [Erzen Krasniqi](https://github.com/erzenkrasniqi)

---

Made with :heart: by [Erzen Krasniqi](https://github.com/erzenkrasniqi)
