/**
 * Theme System for Erzencode CLI
 * Supports built-in themes and custom themes
 */

// ============================================================================
// Theme Types
// ============================================================================

export interface ThemeColors {
  // Primary colors
  primary: string;
  secondary: string;
  accent: string;
  
  // Text colors
  text: string;
  textMuted: string;
  textDim: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // UI colors
  border: string;
  background: string;
  highlight: string;
  
  // Special colors
  thinking: string;
  tool: string;
  user: string;
  assistant: string;
  command: string;
}

export interface Theme {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColors;
}

// ============================================================================
// Built-in Themes
// ============================================================================

export const THEMES: Record<string, Theme> = {
  // Default dark theme - Modern and professional
  dark: {
    id: "dark",
    name: "Dark",
    description: "Default dark theme",
    colors: {
      primary: "#7dd3fc",      // Sky blue - bright on dark
      secondary: "#a5b4fc",    // Indigo light - bright on dark
      accent: "#c4b5fd",       // Violet light - bright on dark
      text: "#f1f5f9",         // Slate 100 - very bright on dark
      textMuted: "#94a3b8",    // Slate 400 - readable on dark
      textDim: "#64748b",      // Slate 500 - subtle on dark
      success: "#4ade80",      // Green bright - visible on dark
      error: "#f87171",        // Red light - visible on dark
      warning: "#fbbf24",      // Amber - visible on dark
      info: "#38bdf8",         // Sky - visible on dark
      border: "#475569",       // Slate 600
      background: "#0f172a",   // Slate 900
      highlight: "#7dd3fc",    // Sky
      thinking: "#c4b5fd",     // Violet
      tool: "#fbbf24",         // Amber
      user: "#4ade80",         // Green
      assistant: "#7dd3fc",    // Sky
      command: "#a5b4fc",      // Indigo
    },
  },

  // Light theme for bright environments
  light: {
    id: "light",
    name: "Light",
    description: "Light theme for bright environments",
    colors: {
      primary: "#2563eb",     // Bright blue - visible on white
      secondary: "#0891b2",   // Teal/cyan - visible on white
      accent: "#9333ea",      // Purple - visible on white
      text: "#1f2937",        // Dark gray - high contrast on white
      textMuted: "#6b7280",   // Medium gray - readable on white
      textDim: "#9ca3af",     // Lighter gray - subtle on white
      success: "#059669",     // Emerald green - visible on white
      error: "#dc2626",       // Red - visible on white
      warning: "#d97706",     // Amber - visible on white
      info: "#2563eb",        // Blue - visible on white
      border: "#d1d5db",      // Light gray border
      background: "#ffffff",  // White
      highlight: "#2563eb",   // Blue
      thinking: "#9333ea",    // Purple
      tool: "#d97706",        // Amber
      user: "#059669",        // Emerald
      assistant: "#2563eb",   // Blue
      command: "#0891b2",     // Teal
    },
  },

  // Dracula - Popular dark theme
  dracula: {
    id: "dracula",
    name: "Dracula",
    description: "Popular dark theme with purple accents",
    colors: {
      primary: "#bd93f9",      // Dracula purple
      secondary: "#8be9fd",    // Dracula cyan
      accent: "#ff79c6",       // Dracula pink
      text: "#f8f8f2",         // Dracula foreground
      textMuted: "#6272a4",    // Dracula comment
      textDim: "#44475a",      // Dracula current line
      success: "#50fa7b",      // Dracula green
      error: "#ff5555",        // Dracula red
      warning: "#ffb86c",      // Dracula orange
      info: "#8be9fd",         // Dracula cyan
      border: "#6272a4",       // Dracula comment
      background: "#282a36",   // Dracula background
      highlight: "#bd93f9",    // Dracula purple
      thinking: "#ff79c6",     // Dracula pink
      tool: "#8be9fd",         // Dracula cyan
      user: "#50fa7b",         // Dracula green
      assistant: "#bd93f9",    // Dracula purple
      command: "#8be9fd",      // Dracula cyan
    },
  },

  // Nord - Cool blue theme
  nord: {
    id: "nord",
    name: "Nord",
    description: "Cool blue arctic theme",
    colors: {
      primary: "#88c0d0",      // Nord frost
      secondary: "#81a1c1",    // Nord frost darker
      accent: "#b48ead",       // Nord aurora purple
      text: "#eceff4",         // Nord snow storm
      textMuted: "#d8dee9",    // Nord snow storm darker
      textDim: "#4c566a",      // Nord polar night
      success: "#a3be8c",      // Nord aurora green
      error: "#bf616a",        // Nord aurora red
      warning: "#ebcb8b",      // Nord aurora yellow
      info: "#88c0d0",         // Nord frost
      border: "#4c566a",       // Nord polar night
      background: "#2e3440",   // Nord polar night
      highlight: "#88c0d0",    // Nord frost
      thinking: "#b48ead",     // Nord aurora purple
      tool: "#ebcb8b",         // Nord aurora yellow
      user: "#a3be8c",         // Nord aurora green
      assistant: "#88c0d0",    // Nord frost
      command: "#81a1c1",      // Nord frost
    },
  },

  // Monokai - Classic coding theme
  monokai: {
    id: "monokai",
    name: "Monokai",
    description: "Classic Monokai coding theme",
    colors: {
      primary: "#e6db74",      // Monokai yellow
      secondary: "#f92672",    // Monokai pink
      accent: "#66d9ef",       // Monokai cyan
      text: "#f8f8f2",         // Monokai foreground
      textMuted: "#75715e",    // Monokai comment
      textDim: "#49483e",      // Monokai selection
      success: "#a6e22e",      // Monokai green
      error: "#f92672",        // Monokai pink
      warning: "#fd971f",      // Monokai orange
      info: "#66d9ef",         // Monokai cyan
      border: "#49483e",       // Monokai selection
      background: "#272822",   // Monokai background
      highlight: "#e6db74",    // Monokai yellow
      thinking: "#ae81ff",     // Monokai purple
      tool: "#66d9ef",         // Monokai cyan
      user: "#a6e22e",         // Monokai green
      assistant: "#e6db74",    // Monokai yellow
      command: "#f92672",      // Monokai pink
    },
  },

  // Solarized Dark
  "solarized-dark": {
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "Solarized dark theme",
    colors: {
      primary: "#2aa198",      // Solarized cyan
      secondary: "#268bd2",    // Solarized blue
      accent: "#b58900",       // Solarized yellow
      text: "#839496",         // Solarized base0
      textMuted: "#657b83",    // Solarized base00
      textDim: "#586e75",      // Solarized base01
      success: "#859900",      // Solarized green
      error: "#dc322f",        // Solarized red
      warning: "#cb4b16",      // Solarized orange
      info: "#2aa198",         // Solarized cyan
      border: "#586e75",       // Solarized base01
      background: "#002b36",   // Solarized base03
      highlight: "#2aa198",    // Solarized cyan
      thinking: "#d33682",     // Solarized magenta
      tool: "#b58900",         // Solarized yellow
      user: "#859900",         // Solarized green
      assistant: "#2aa198",    // Solarized cyan
      command: "#268bd2",      // Solarized blue
    },
  },

  // GitHub Dark
  "github-dark": {
    id: "github-dark",
    name: "GitHub Dark",
    description: "GitHub dark theme",
    colors: {
      primary: "#58a6ff",      // GitHub blue
      secondary: "#79c0ff",    // GitHub light blue
      accent: "#d2a8ff",       // GitHub purple
      text: "#c9d1d9",         // GitHub text
      textMuted: "#8b949e",    // GitHub muted
      textDim: "#484f58",      // GitHub dim
      success: "#3fb950",      // GitHub green
      error: "#f85149",        // GitHub red
      warning: "#d29922",      // GitHub yellow
      info: "#58a6ff",         // GitHub blue
      border: "#30363d",       // GitHub border
      background: "#0d1117",   // GitHub background
      highlight: "#58a6ff",    // GitHub blue
      thinking: "#d2a8ff",     // GitHub purple
      tool: "#d29922",         // GitHub yellow
      user: "#3fb950",         // GitHub green
      assistant: "#58a6ff",    // GitHub blue
      command: "#79c0ff",      // GitHub light blue
    },
  },

  // One Dark - Atom theme
  "one-dark": {
    id: "one-dark",
    name: "One Dark",
    description: "Atom One Dark theme",
    colors: {
      primary: "#61afef",      // One Dark blue
      secondary: "#56b6c2",    // One Dark cyan
      accent: "#c678dd",       // One Dark purple
      text: "#abb2bf",         // One Dark foreground
      textMuted: "#5c6370",    // One Dark comment
      textDim: "#4b5263",      // One Dark selection
      success: "#98c379",      // One Dark green
      error: "#e06c75",        // One Dark red
      warning: "#e5c07b",      // One Dark yellow
      info: "#61afef",         // One Dark blue
      border: "#3e4451",       // One Dark gutter
      background: "#282c34",   // One Dark background
      highlight: "#61afef",    // One Dark blue
      thinking: "#c678dd",     // One Dark purple
      tool: "#e5c07b",         // One Dark yellow
      user: "#98c379",         // One Dark green
      assistant: "#61afef",    // One Dark blue
      command: "#56b6c2",      // One Dark cyan
    },
  },

  // Catppuccin Mocha - Pastel theme
  catppuccin: {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Soothing pastel theme",
    colors: {
      primary: "#cba6f7",      // Catppuccin mauve
      secondary: "#89b4fa",    // Catppuccin blue
      accent: "#f5c2e7",       // Catppuccin pink
      text: "#cdd6f4",         // Catppuccin text
      textMuted: "#a6adc8",    // Catppuccin subtext0
      textDim: "#6c7086",      // Catppuccin overlay0
      success: "#a6e3a1",      // Catppuccin green
      error: "#f38ba8",        // Catppuccin red
      warning: "#f9e2af",      // Catppuccin yellow
      info: "#89dceb",         // Catppuccin sky
      border: "#45475a",       // Catppuccin surface0
      background: "#1e1e2e",   // Catppuccin base
      highlight: "#cba6f7",    // Catppuccin mauve
      thinking: "#f5c2e7",     // Catppuccin pink
      tool: "#89dceb",         // Catppuccin sky
      user: "#a6e3a1",         // Catppuccin green
      assistant: "#cba6f7",    // Catppuccin mauve
      command: "#89b4fa",      // Catppuccin blue
    },
  },

  // Gruvbox Dark
  gruvbox: {
    id: "gruvbox",
    name: "Gruvbox",
    description: "Retro groove color scheme",
    colors: {
      primary: "#fabd2f",      // Gruvbox yellow
      secondary: "#8ec07c",    // Gruvbox aqua
      accent: "#d3869b",       // Gruvbox purple
      text: "#ebdbb2",         // Gruvbox foreground
      textMuted: "#a89984",    // Gruvbox gray
      textDim: "#665c54",      // Gruvbox bg3
      success: "#b8bb26",      // Gruvbox green
      error: "#fb4934",        // Gruvbox red
      warning: "#fe8019",      // Gruvbox orange
      info: "#83a598",         // Gruvbox blue
      border: "#504945",       // Gruvbox bg2
      background: "#282828",   // Gruvbox background
      highlight: "#fabd2f",    // Gruvbox yellow
      thinking: "#d3869b",     // Gruvbox purple
      tool: "#8ec07c",         // Gruvbox aqua
      user: "#b8bb26",         // Gruvbox green
      assistant: "#fabd2f",    // Gruvbox yellow
      command: "#8ec07c",      // Gruvbox aqua
    },
  },

  // Minimal - Clean and simple
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Clean and minimal theme",
    colors: {
      primary: "#e5e5e5",      // Neutral 200
      secondary: "#a3a3a3",    // Neutral 400
      accent: "#d4d4d4",       // Neutral 300
      text: "#fafafa",         // Neutral 50
      textMuted: "#a3a3a3",    // Neutral 400
      textDim: "#737373",      // Neutral 500
      success: "#86efac",      // Green 300
      error: "#fca5a5",        // Red 300
      warning: "#fcd34d",      // Amber 300
      info: "#e5e5e5",         // Neutral 200
      border: "#525252",       // Neutral 600
      background: "#171717",   // Neutral 900
      highlight: "#e5e5e5",    // Neutral 200
      thinking: "#a3a3a3",     // Neutral 400
      tool: "#a3a3a3",         // Neutral 400
      user: "#fafafa",         // Neutral 50
      assistant: "#e5e5e5",    // Neutral 200
      command: "#a3a3a3",      // Neutral 400
    },
  },

  // High Contrast - Accessibility
  "high-contrast": {
    id: "high-contrast",
    name: "High Contrast",
    description: "High contrast for accessibility",
    colors: {
      primary: "#ffffff",      // Pure white
      secondary: "#ffff00",    // Pure yellow
      accent: "#00ffff",       // Pure cyan
      text: "#ffffff",         // Pure white
      textMuted: "#e0e0e0",    // Very light gray
      textDim: "#b0b0b0",      // Light gray
      success: "#00ff00",      // Pure green
      error: "#ff0000",        // Pure red
      warning: "#ffff00",      // Pure yellow
      info: "#00ffff",         // Pure cyan
      border: "#ffffff",       // Pure white
      background: "#000000",   // Pure black
      highlight: "#ffff00",    // Pure yellow
      thinking: "#00ffff",     // Pure cyan
      tool: "#ffff00",         // Pure yellow
      user: "#00ff00",         // Pure green
      assistant: "#ffffff",    // Pure white
      command: "#00ffff",      // Pure cyan
    },
  },
};

// ============================================================================
// Theme Functions
// ============================================================================

let currentTheme: Theme = THEMES.dark!;

/**
 * Get the current theme
 */
export function getCurrentTheme(): Theme {
  return currentTheme;
}

/**
 * Set the current theme by ID
 */
export function setTheme(themeId: string): Theme {
  const theme = THEMES[themeId];
  if (theme) {
    currentTheme = theme;
  }
  return currentTheme;
}

/**
 * Get all available theme IDs
 */
export function getThemeIds(): string[] {
  return Object.keys(THEMES);
}

/**
 * Get all available themes
 */
export function getAllThemes(): Theme[] {
  return Object.values(THEMES);
}

/**
 * Get a specific theme by ID
 */
export function getTheme(themeId: string): Theme | undefined {
  return THEMES[themeId];
}

/**
 * Get color from current theme
 */
export function getColor(key: keyof ThemeColors): string {
  return currentTheme.colors[key];
}

/**
 * Auto-detect system theme (dark/light)
 */
export function detectSystemTheme(): "dark" | "light" {
  // Check for common environment variables or terminal settings
  const colorterm = process.env.COLORTERM;
  const term = process.env.TERM;
  
  // Most terminals default to dark, so we'll default to dark
  // In a more sophisticated implementation, we could check macOS appearance
  return "dark";
}

/**
 * Initialize theme from config or system preference
 */
export function initTheme(themeId?: string): Theme {
  if (themeId) {
    const theme = THEMES[themeId];
    if (theme) {
      currentTheme = theme;
      return theme;
    }
  }
  
  // Auto-detect based on system
  const systemTheme = detectSystemTheme();
  const theme = THEMES[systemTheme];
  if (theme) {
    currentTheme = theme;
    return theme;
  }
  
  return currentTheme;
}
