/**
 * GitHub Copilot Authentication
 * Handles OAuth device flow for GitHub Copilot subscription
 */

import { getConfigDir } from "./config.js";
import fs from "fs/promises";
import path from "path";

// ============================================================================
// Types
// ============================================================================

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface CopilotTokenResponse {
  token: string;
  expires_at: number;
}

interface CopilotAuthData {
  githubToken: string;
  copilotToken?: string;
  copilotTokenExpiresAt?: number;
}

// ============================================================================
// Constants
// ============================================================================

const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98"; // VS Code Copilot client ID
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const AUTH_FILE = "copilot-auth.json";

// ============================================================================
// File Storage
// ============================================================================

async function getAuthFilePath(): Promise<string> {
  const configDir = getConfigDir();
  return path.join(configDir, AUTH_FILE);
}

async function loadAuthData(): Promise<CopilotAuthData | null> {
  try {
    const filePath = await getAuthFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as CopilotAuthData;
  } catch {
    return null;
  }
}

async function saveAuthData(data: CopilotAuthData): Promise<void> {
  const filePath = await getAuthFilePath();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ============================================================================
// OAuth Device Flow
// ============================================================================

/**
 * Start the device code flow for GitHub OAuth
 */
export async function startDeviceFlow(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: "copilot",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start device flow: ${response.status}`);
  }

  return (await response.json()) as DeviceCodeResponse;
}

/**
 * Poll for the access token after user authorizes
 */
export async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onPoll?: () => void,
): Promise<string> {
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    if (onPoll) onPoll();

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const data = (await response.json()) as any;

    if (data.access_token) {
      // Save the token
      await saveAuthData({ githubToken: data.access_token });
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      continue;
    }

    if (data.error === "slow_down") {
      interval += 5;
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("Authorization expired. Please try again.");
    }

    if (data.error === "access_denied") {
      throw new Error("Access denied by user.");
    }

    if (data.error) {
      throw new Error(`OAuth error: ${data.error}`);
    }
  }

  throw new Error("Authorization timed out. Please try again.");
}

// ============================================================================
// Copilot Token
// ============================================================================

/**
 * Get or refresh the Copilot API token
 */
export async function getCopilotToken(): Promise<string> {
  const authData = await loadAuthData();

  if (!authData?.githubToken) {
    throw new Error(
      "Not authenticated with GitHub. Please run /connect and select GitHub Copilot.",
    );
  }

  // Check if we have a valid cached token
  if (authData.copilotToken && authData.copilotTokenExpiresAt) {
    const now = Date.now();
    // Refresh if expires within 5 minutes
    if (authData.copilotTokenExpiresAt - now > 5 * 60 * 1000) {
      return authData.copilotToken;
    }
  }

  // Fetch new Copilot token
  const response = await fetch(COPILOT_TOKEN_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authData.githubToken}`,
      Accept: "application/json",
      "User-Agent": "erzencode-cli/1.0",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "GitHub token expired. Please re-authenticate with /connect.",
      );
    }
    throw new Error(`Failed to get Copilot token: ${response.status}`);
  }

  const data = (await response.json()) as CopilotTokenResponse;

  // Save the new token
  await saveAuthData({
    ...authData,
    copilotToken: data.token,
    copilotTokenExpiresAt: data.expires_at * 1000, // Convert to ms
  });

  return data.token;
}

/**
 * Check if user is authenticated with GitHub Copilot
 */
export async function isCopilotAuthenticated(): Promise<boolean> {
  const authData = await loadAuthData();
  return !!authData?.githubToken;
}

/**
 * Get the GitHub token if authenticated
 */
export async function getGitHubToken(): Promise<string | null> {
  const authData = await loadAuthData();
  return authData?.githubToken ?? null;
}

/**
 * Clear Copilot authentication
 */
export async function clearCopilotAuth(): Promise<void> {
  const filePath = await getAuthFilePath();
  try {
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist, that's fine
  }
}

// ============================================================================
// Copilot API
// ============================================================================

const COPILOT_CHAT_URL = "https://api.githubcopilot.com/chat/completions";

/**
 * Make a request to the Copilot API
 */
export async function copilotRequest(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {},
): Promise<Response> {
  const token = await getCopilotToken();

  const body: any = {
    model,
    messages,
    stream: options.stream ?? false,
  };

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }
  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
  }

  const response = await fetch(COPILOT_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: options.stream ? "text/event-stream" : "application/json",
      "User-Agent": "erzencode-cli/1.0",
      "Copilot-Integration-Id": "vscode-chat",
      "Editor-Version": "vscode/1.90.0",
      "Editor-Plugin-Version": "copilot-chat/0.17.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Copilot API error: ${response.status} - ${error}`);
  }

  return response;
}

/**
 * Available Copilot models
 * Based on https://docs.github.com/en/copilot/reference/ai-models/supported-models
 */
export const COPILOT_MODELS = [
  // Claude Models
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5 (Copilot)",
    description: "Fast, cost-effective Claude model (0.33x multiplier)",
  },
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4 (Copilot)",
    description: "Balanced Claude model via Copilot",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5 (Copilot)",
    description: "Latest Claude Sonnet via Copilot",
  },
  {
    id: "claude-opus-4.1",
    name: "Claude Opus 4.1 (Copilot)",
    description: "Most capable Claude (10x multiplier, Pro+ required)",
  },
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5 (Copilot)",
    description: "Latest Claude Opus (3x multiplier)",
  },
  // GPT Models
  {
    id: "gpt-4.1",
    name: "GPT-4.1 (Copilot)",
    description: "Free tier GPT model (0x multiplier)",
  },
  {
    id: "gpt-5",
    name: "GPT-5 (Copilot)",
    description: "Latest GPT-5 via Copilot",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini (Copilot)",
    description: "Free tier GPT-5 Mini (0x multiplier)",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1 (Copilot)",
    description: "GPT-5.1 via Copilot",
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2 (Copilot)",
    description: "Latest GPT-5.2 via Copilot",
  },
  // Gemini Models
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro (Copilot)",
    description: "Google Gemini 2.5 Pro via Copilot",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash (Copilot)",
    description: "Fast Gemini 3 Flash (0.33x multiplier, preview)",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro (Copilot)",
    description: "Gemini 3 Pro via Copilot (preview)",
  },
  // Grok Models
  {
    id: "grok-code-fast-1",
    name: "Grok Code Fast 1 (Copilot)",
    description: "Fast xAI Grok for coding (0.25x multiplier)",
  },
];
