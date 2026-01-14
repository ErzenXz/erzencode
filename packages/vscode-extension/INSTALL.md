# Installation Guide - ErzenCode VSCode Extension

## Quick Install

### Option 1: Install from VSIX File

1. Download the latest `.vsix` file from [Releases](https://github.com/ErzenXz/erzencode/releases)

2. Install in VSCode:
   ```bash
   code --install-extension erzencode-vscode-0.3.0.vsix
   ```

   Or from VSCode:
   - Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac)
   - Type "Install from VSIX"
   - Select the downloaded file

### Option 2: Install from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/ErzenXz/erzencode.git
   cd erzencode
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build:extension
   ```

4. Install:
   ```bash
   code --install-extension packages/vscode-extension/erzencode-vscode-0.3.0.vsix
   ```

### Option 3: Development Mode

1. Open the `packages/vscode-extension` folder in VSCode

2. Press `F5` to launch a new VSCode window (Extension Development Host) with the extension loaded

## First Time Setup

### Configure API Keys

The extension shares configuration with the CLI. Set up your API keys:

```bash
# Initialize configuration
erzencode init

# Or manually set API key
export ANTHROPIC_API_KEY=your_key_here
```

### Configure in VSCode Settings

You can also configure via VSCode settings (`settings.json`):

```json
{
  "erzencode.provider": "anthropic",
  "erzencode.model": "claude-sonnet-4-20250514",
  "erzencode.mode": "agent",
  "erzencode.thinkingLevel": "off"
}
```

## Verify Installation

1. Open VSCode
2. Look for the **ErzenCode** icon in the Activity Bar (sidebar)
3. Click the icon to open the chat panel
4. Or press `Ctrl+Shift+E` (Cmd+Shift+E) for Quick Chat

## Usage

### Start Chatting

1. Click the ErzenCode icon in the sidebar
2. Type your message in the input box
3. Press Enter to send

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Quick Chat |
| `Ctrl+Shift+P` → "ErzenCode" | See all commands |

### Commands

- `ErzenCode: Open Chat` - Open the chat sidebar
- `ErzenCode: Quick Chat` - Quick chat with input box
- `ErzenCode: Explain Code` - Explain selected code
- `ErzenCode: Fix Code` - Fix selected code
- `ErzenCode: New Session` - Start a new session

## Troubleshooting

### Extension not loading?

1. Check VSCode version (requires 1.80+)
2. Reload VSCode: `Ctrl+Shift+P` → "Reload Window"
3. Check Developer Tools for errors: `Help` → `Toggle Developer Tools`

### API key errors?

1. Run `erzencode init` in terminal
2. Or set environment variable: `export ANTHROPIC_API_KEY=your_key`
3. Restart VSCode

### Chat not responding?

1. Check your internet connection
2. Verify API key is valid
3. Check provider status (e.g., Anthropic API status)
4. See Developer Tools console for errors

## Uninstall

```bash
code --uninstall-extension erzenkrasniqi.erzencode-vscode
```

Or in VSCode:
1. Press `Ctrl+Shift+X` to open Extensions
2. Search for "ErzenCode"
3. Click the gear icon → "Uninstall"

## Support

- **Issues**: [GitHub Issues](https://github.com/ErzenXz/erzencode/issues)
- **Documentation**: [README.md](../README.md)
- **CLI Documentation**: [../../README.md](../../README.md)
