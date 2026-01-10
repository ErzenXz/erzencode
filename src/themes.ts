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
      primary: "cyan",
      secondary: "blue",
      accent: "magenta",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "gray",
      background: "black",
      highlight: "cyan",
      thinking: "magenta",
      tool: "yellow",
      user: "green",
      assistant: "cyan",
      command: "blue",
    },
  },

  // Light theme for bright environments
  light: {
    id: "light",
    name: "Light",
    description: "Light theme for bright environments",
    colors: {
      primary: "blue",
      secondary: "cyan",
      accent: "magenta",
      text: "black",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "blue",
      border: "gray",
      background: "white",
      highlight: "blue",
      thinking: "magenta",
      tool: "yellow",
      user: "green",
      assistant: "blue",
      command: "cyan",
    },
  },

  // Dracula - Popular dark theme
  dracula: {
    id: "dracula",
    name: "Dracula",
    description: "Popular dark theme with purple accents",
    colors: {
      primary: "magenta",
      secondary: "cyan",
      accent: "magenta",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "magenta",
      background: "black",
      highlight: "magenta",
      thinking: "magenta",
      tool: "cyan",
      user: "green",
      assistant: "magenta",
      command: "cyan",
    },
  },

  // Nord - Cool blue theme
  nord: {
    id: "nord",
    name: "Nord",
    description: "Cool blue arctic theme",
    colors: {
      primary: "cyan",
      secondary: "blue",
      accent: "cyan",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "blue",
      background: "black",
      highlight: "cyan",
      thinking: "cyan",
      tool: "yellow",
      user: "green",
      assistant: "cyan",
      command: "blue",
    },
  },

  // Monokai - Classic coding theme
  monokai: {
    id: "monokai",
    name: "Monokai",
    description: "Classic Monokai coding theme",
    colors: {
      primary: "yellow",
      secondary: "magenta",
      accent: "cyan",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "yellow",
      background: "black",
      highlight: "yellow",
      thinking: "magenta",
      tool: "cyan",
      user: "green",
      assistant: "yellow",
      command: "magenta",
    },
  },

  // Solarized Dark
  "solarized-dark": {
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "Solarized dark theme",
    colors: {
      primary: "cyan",
      secondary: "blue",
      accent: "yellow",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "cyan",
      background: "black",
      highlight: "cyan",
      thinking: "magenta",
      tool: "yellow",
      user: "green",
      assistant: "cyan",
      command: "blue",
    },
  },

  // GitHub Dark
  "github-dark": {
    id: "github-dark",
    name: "GitHub Dark",
    description: "GitHub dark theme",
    colors: {
      primary: "blue",
      secondary: "cyan",
      accent: "magenta",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "blue",
      border: "gray",
      background: "black",
      highlight: "blue",
      thinking: "magenta",
      tool: "yellow",
      user: "green",
      assistant: "blue",
      command: "cyan",
    },
  },

  // One Dark - Atom theme
  "one-dark": {
    id: "one-dark",
    name: "One Dark",
    description: "Atom One Dark theme",
    colors: {
      primary: "cyan",
      secondary: "blue",
      accent: "magenta",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "gray",
      background: "black",
      highlight: "cyan",
      thinking: "magenta",
      tool: "yellow",
      user: "green",
      assistant: "cyan",
      command: "blue",
    },
  },

  // Catppuccin Mocha - Pastel theme
  catppuccin: {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Soothing pastel theme",
    colors: {
      primary: "magenta",
      secondary: "blue",
      accent: "cyan",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "magenta",
      background: "black",
      highlight: "magenta",
      thinking: "magenta",
      tool: "cyan",
      user: "green",
      assistant: "magenta",
      command: "blue",
    },
  },

  // Gruvbox Dark
  gruvbox: {
    id: "gruvbox",
    name: "Gruvbox",
    description: "Retro groove color scheme",
    colors: {
      primary: "yellow",
      secondary: "cyan",
      accent: "magenta",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "yellow",
      background: "black",
      highlight: "yellow",
      thinking: "magenta",
      tool: "cyan",
      user: "green",
      assistant: "yellow",
      command: "cyan",
    },
  },

  // Minimal - Clean and simple
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Clean and minimal theme",
    colors: {
      primary: "white",
      secondary: "gray",
      accent: "white",
      text: "white",
      textMuted: "gray",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "white",
      border: "gray",
      background: "black",
      highlight: "white",
      thinking: "gray",
      tool: "gray",
      user: "white",
      assistant: "white",
      command: "gray",
    },
  },

  // High Contrast - Accessibility
  "high-contrast": {
    id: "high-contrast",
    name: "High Contrast",
    description: "High contrast for accessibility",
    colors: {
      primary: "white",
      secondary: "yellow",
      accent: "cyan",
      text: "white",
      textMuted: "white",
      textDim: "gray",
      success: "green",
      error: "red",
      warning: "yellow",
      info: "cyan",
      border: "white",
      background: "black",
      highlight: "yellow",
      thinking: "cyan",
      tool: "yellow",
      user: "green",
      assistant: "white",
      command: "cyan",
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
