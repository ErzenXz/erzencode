/**
 * Context Compaction Service
 * Summarizes conversation history when context window is filling up
 */

import { generateText, type LanguageModel } from "ai";
import { createProvider, type ProviderType } from "./ai-provider.js";

export interface CompactionConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface CompactionResult {
  success: boolean;
  summary: string;
  originalMessageCount: number;
  tokensSaved?: number;
  error?: string;
}

const COMPACTION_SYSTEM_PROMPT = `You are a conversation summarizer for a coding assistant. Your task is to create a concise but comprehensive summary of the conversation history.

Your summary should capture:
1. **User's Goals**: What the user was trying to accomplish
2. **Work Completed**: Key actions taken, files modified, code written
3. **Current State**: Where things stand now (any pending tasks, errors, or next steps)
4. **Important Context**: Any decisions made, constraints mentioned, or technical details that would be needed to continue

Format your summary as a structured markdown document with clear sections. Be concise but don't lose critical context that would be needed to continue the work.

Example format:
## Summary of Previous Work

### Goals
- [User's main objectives]

### Completed
- [List of completed tasks with key details]
- [Files modified: file1.ts, file2.ts]

### Current State
- [Where things stand]
- [Any pending tasks]

### Key Context
- [Important technical decisions]
- [Constraints or requirements]
- [Any errors or issues encountered]

### Next Steps
- [What was planned next, if mentioned]`;

/**
 * Compact/summarize a conversation history to reduce context usage
 */
export async function compactConversation(
  messages: ConversationMessage[],
  config: CompactionConfig,
): Promise<CompactionResult> {
  if (messages.length === 0) {
    return {
      success: true,
      summary: "",
      originalMessageCount: 0,
    };
  }

  try {
    // Create the language model
    const languageModel = createProvider({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    // Format messages for summarization
    const formattedMessages = messages
      .map((m) => {
        const role =
          m.role === "user"
            ? "User"
            : m.role === "assistant"
              ? "Assistant"
              : "System";
        return `**${role}**:\n${m.content}`;
      })
      .join("\n\n---\n\n");

    // Create the prompt
    const prompt = `Please summarize the following conversation history between a user and a coding assistant:

<conversation>
${formattedMessages}
</conversation>

Provide a comprehensive summary that captures all the important context needed to continue this work.`;

    // Generate the summary
    const result = await generateText({
      model: languageModel,
      system: COMPACTION_SYSTEM_PROMPT,
      prompt,
      temperature: 0.3,
    });

    return {
      success: true,
      summary: result.text,
      originalMessageCount: messages.length,
    };
  } catch (error: any) {
    return {
      success: false,
      summary: "",
      originalMessageCount: messages.length,
      error: error.message || String(error),
    };
  }
}

/**
 * Check if context should be compacted based on usage
 * @param currentTokens Current token count
 * @param maxTokens Maximum context window
 * @param threshold Percentage threshold to trigger compaction (default 80%)
 */
export function shouldCompact(
  currentTokens: number,
  maxTokens: number,
  threshold: number = 0.8,
): boolean {
  return currentTokens >= maxTokens * threshold;
}

/**
 * Create a compacted message to replace conversation history
 */
export function createCompactedMessage(
  summary: string,
  originalCount: number,
): ConversationMessage {
  const header = `[Context Compacted: ${originalCount} messages summarized]\n\n`;
  return {
    role: "system",
    content: header + summary,
    timestamp: Date.now(),
  };
}

/**
 * Estimate tokens for a message using improved heuristics
 *
 * Token estimation varies by model but general rules:
 * - English text: ~4 characters per token (or ~0.75 words per token)
 * - Code: ~3 characters per token (more symbols and shorter words)
 * - CJK/Unicode: ~1-2 characters per token
 * - Whitespace and punctuation often get their own tokens
 *
 * This uses a weighted approach based on content type
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count different character types
  const codePattern = /[{}[\]();:=<>!&|+\-*/%^~`@#$\\]/g;
  const whitespacePattern = /\s+/g;
  const wordPattern = /\b\w+\b/g;

  const codeChars = (text.match(codePattern) || []).length;
  const words = (text.match(wordPattern) || []).length;
  const whitespaceGroups = (text.match(whitespacePattern) || []).length;

  // Estimate based on content
  // - Each word is roughly 1-2 tokens (avg 1.3)
  // - Code symbols often get their own tokens
  // - Whitespace groups typically become 1 token each
  // - Add a base for any remaining characters

  const wordTokens = Math.ceil(words * 1.3);
  const codeTokens = Math.ceil(codeChars * 0.5); // Many symbols combine
  const whitespaceTokens = whitespaceGroups;

  // Use the more accurate of character-based or content-based estimate
  const charBasedEstimate = Math.ceil(text.length / 4);
  const contentBasedEstimate = wordTokens + codeTokens + whitespaceTokens;

  // Weight towards content-based for longer texts, character-based for short
  if (text.length < 50) {
    return Math.max(1, charBasedEstimate);
  }

  // Use average of both methods for better accuracy
  return Math.max(1, Math.ceil((charBasedEstimate + contentBasedEstimate) / 2));
}

/**
 * Estimate tokens for an array of messages (conversation history)
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
): number {
  let total = 0;

  // System prompt
  if (systemPrompt) {
    total += estimateTokens(systemPrompt);
    total += 4; // Message overhead (role, separators)
  }

  // Each message has overhead (~4 tokens for role, separators, etc.)
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    total += 4; // Message overhead
  }

  // Add 2 tokens for start/end
  total += 2;

  return total;
}

/**
 * Format the compaction result for display
 */
export function formatCompactionResult(result: CompactionResult): string {
  if (!result.success) {
    return `Compaction failed: ${result.error}`;
  }

  const parts = [`Compacted ${result.originalMessageCount} messages`];

  if (result.tokensSaved) {
    parts.push(`Saved ~${Math.round(result.tokensSaved / 1000)}K tokens`);
  }

  return parts.join(" | ");
}
