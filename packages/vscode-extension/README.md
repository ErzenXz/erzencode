# ErzenCode VSCode Extension

AI-powered coding assistant for VSCode with full feature parity to the CLI.

## Features

- ✅ **Side Panel Chat Interface** - Chat with AI directly in VSCode's sidebar
- ✅ **Multiple AI Providers** - Support for Anthropic, OpenAI, Google, xAI, Mistral, Ollama
- ✅ **Quick Commands** - Fast keyboard shortcuts for common actions
- ✅ **Code Actions** - Explain and fix code with a single command
- ✅ **Shared Configuration** - Uses the same config as the CLI
- ⏳ **File Operations** - Read, write, and edit files (TODO)
- ⏳ **Terminal Integration** - Run shell commands (TODO)
- ⏳ **Git Operations** - Status, diff, commit (TODO)
- ⏳ **Codebase Search** - Semantic search with LanceDB (TODO)

## Installation

### Development Installation

1. Build the extension:
```bash
pnpm build:extension
```

2. Install in VSCode:
```bash
code --install-extension packages/vscode-extension/erzencode-vscode-0.3.0.vsix --force
```

### From Source

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build: `pnpm build`
4. Press F5 in VSCode to launch Extension Development Host

## Usage

### Starting a Chat

1. Click the ErzenCode icon in the Activity Bar
2. Or press `Ctrl+Shift+E` (Cmd+Shift+E on Mac) for Quick Chat
3. Type your message and press Enter

### Commands

| Command | Keyboard Shortcut | Description |
|---------|------------------|-------------|
| `erzencode.openChat` | - | Open ErzenCode Chat sidebar |
| `erzencode.quickChat` | `Ctrl+Shift+E` | Quick chat with input box |
| `erzencode.explainCode` | - | Explain selected code |
| `erzencode.fixCode` | - | Fix selected code |
| `erzencode.newSession` | - | Start new session |

### Configuration

The extension shares configuration with the CLI. Configure using:
```bash
erzencode init
```

Or set via VSCode settings:

```json
{
  "erzencode.provider": "anthropic",
  "erzencode.model": "claude-sonnet-4-20250514",
  "erzencode.mode": "agent",
  "erzencode.thinkingLevel": "off"
}
```

## Architecture

```
packages/
├── core/                    # Shared business logic
│   ├── src/
│   │   ├── ai-agent.ts      # AI agent orchestration
│   │   ├── ai-provider.ts   # Provider implementations
│   │   ├── config.ts        # Configuration management
│   │   ├── platform/        # Platform abstractions
│   │   │   ├── FileSystemAdapter.ts
│   │   │   └── TerminalAdapter.ts
│   │   └── tools/           # AI tools
│   └── dist/
├── cli/                     # CLI application
│   ├── src/
│   │   ├── cli.ts
│   │   ├── ui/              # Terminal UI
│   │   └── platform/        # Node.js adapters
│   └── dist/
└── vscode-extension/        # VSCode extension
    ├── src/
    │   ├── extension.ts     # Entry point
    │   ├── sidebar/         # Side panel UI
    │   ├── providers/       # VSCode API adapters
    │   ├── services/        # Agent service
    │   └── commands/        # Command handlers
    └── dist/
```

## Development

### Project Structure

- **extension.ts** - Extension activation and command registration
- **SidebarProvider.ts** - Manages the sidebar webview
- **AgentService.ts** - Wraps the core AI agent
- **providers/** - VSCode-specific implementations of platform adapters
- **commands/** - VSCode command handlers

### Building

```bash
# Build all packages
pnpm build

# Build only extension
pnpm build:extension

# Build in watch mode
pnpm dev:extension
```

### Testing

```bash
# Run tests
pnpm test

# Run in Extension Development Host
# Press F5 in VSCode
```

## Roadmap

- [ ] Full file operation support
- [ ] Shell command execution with approval UI
- [ ] Git integration (status, diff, commit)
- [ ] Semantic codebase search
- [ ] Session management
- [ ] Streaming responses with real-time updates
- [ ] React-based webview UI (currently using simple HTML)
- [ ] Code highlighting in responses
- [ ] @-mentions for files and symbols
- [ ] Multi-file editing
- [ ] Diff preview for edits

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md)

## License

MIT - see [LICENSE](../../LICENSE)

## Support

- Issues: [GitHub Issues](https://github.com/ErzenXz/erzencode/issues)
- Docs: [README.md](../../README.md)
