/**
 * Subagent Architecture for Coding CLI
 * Main agent can delegate specialized tasks to subagents
 */

import { z } from "zod";
import {
  generateText,
  streamText,
  tool,
  type LanguageModel,
  type Tool,
} from "ai";
import { createProvider, type ProviderType } from "./ai-provider.js";

// ============================================================================
// Types
// ============================================================================

export interface SubagentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  provider?: ProviderType;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SubagentResult {
  success: boolean;
  output: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SubagentDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (input: any, parentContext?: string) => Promise<SubagentResult>;
}

// ============================================================================
// Subagent Registry
// ============================================================================

const subagentRegistry = new Map<string, SubagentDefinition>();

export function registerSubagent(definition: SubagentDefinition): void {
  subagentRegistry.set(definition.name, definition);
}

export function getSubagent(name: string): SubagentDefinition | undefined {
  return subagentRegistry.get(name);
}

export function getAllSubagents(): SubagentDefinition[] {
  return Array.from(subagentRegistry.values());
}

// ============================================================================
// Create Subagent Tool
// ============================================================================

export function createSubagentTool(
  config: SubagentConfig,
  inputSchema: z.ZodType<any>,
  formatPrompt: (input: any, parentContext?: string) => string,
): SubagentDefinition {
  return {
    name: config.name,
    description: config.description,
    inputSchema,
    execute: async (input: any, parentContext?: string) => {
      try {
        const provider = config.provider || "anthropic";
        const model = config.model || "claude-sonnet-4-20250514";

        const languageModel = createProvider({
          provider,
          model,
        });

        const prompt = formatPrompt(input, parentContext);

        const result = await generateText({
          model: languageModel,
          system: config.systemPrompt,
          prompt,
          temperature: config.temperature || 0.3,
        });

        return {
          success: true,
          output: result.text,
          usage: result.usage
            ? {
                promptTokens: (result.usage as any).promptTokens ?? 0,
                completionTokens: (result.usage as any).completionTokens ?? 0,
                totalTokens: (result.usage as any).totalTokens ?? 0,
              }
            : undefined,
        };
      } catch (error: any) {
        return {
          success: false,
          output: "",
          error: error.message || String(error),
        };
      }
    },
  };
}

// ============================================================================
// Built-in Subagents
// ============================================================================

// Code Review Subagent
export const codeReviewSubagent = createSubagentTool(
  {
    name: "code_review",
    description:
      "Reviews code for bugs, security issues, and improvements. Provides detailed feedback on code quality.",
    systemPrompt: `You are an expert code reviewer. Analyze the provided code and provide:
1. **Bugs**: Identify any bugs or potential runtime errors
2. **Security**: Flag security vulnerabilities
3. **Performance**: Suggest performance improvements
4. **Style**: Note code style issues
5. **Best Practices**: Recommend improvements

Be concise but thorough. Focus on actionable feedback.`,
  },
  z.object({
    code: z.string().describe("The code to review"),
    language: z.string().optional().describe("Programming language"),
    context: z
      .string()
      .optional()
      .describe("Additional context about the code"),
  }),
  (input) => {
    let prompt = `Review this ${input.language || "code"}:\n\n\`\`\`${input.language || ""}\n${input.code}\n\`\`\``;
    if (input.context) prompt += `\n\nContext: ${input.context}`;
    return prompt;
  },
);

// Test Generator Subagent
export const testGeneratorSubagent = createSubagentTool(
  {
    name: "generate_tests",
    description:
      "Generates unit tests for the provided code. Creates comprehensive test cases.",
    systemPrompt: `You are an expert test engineer. Generate comprehensive unit tests for the provided code.

Guidelines:
- Write tests using the appropriate testing framework
- Cover edge cases and error conditions
- Use descriptive test names
- Include both positive and negative test cases
- Mock dependencies appropriately

Output only the test code, no explanations.`,
  },
  z.object({
    code: z.string().describe("The code to generate tests for"),
    language: z.string().describe("Programming language"),
    framework: z
      .string()
      .optional()
      .describe("Testing framework to use (jest, pytest, etc.)"),
  }),
  (input) => {
    let prompt = `Generate tests for this ${input.language} code`;
    if (input.framework) prompt += ` using ${input.framework}`;
    prompt += `:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\``;
    return prompt;
  },
);

// Documentation Generator Subagent
export const docGeneratorSubagent = createSubagentTool(
  {
    name: "generate_docs",
    description:
      "Generates documentation for code including JSDoc, docstrings, or README content.",
    systemPrompt: `You are a technical writer. Generate clear, comprehensive documentation for the provided code.

Guidelines:
- Use the appropriate documentation format for the language
- Include descriptions, parameters, return values, and examples
- Be concise but complete
- Follow best practices for the language's documentation standards`,
  },
  z.object({
    code: z.string().describe("The code to document"),
    language: z.string().describe("Programming language"),
    docType: z
      .enum(["inline", "readme", "api"])
      .optional()
      .describe("Type of documentation to generate"),
  }),
  (input) => {
    const docType = input.docType || "inline";
    return `Generate ${docType} documentation for this ${input.language} code:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\``;
  },
);

// Refactoring Subagent
export const refactoringSubagent = createSubagentTool(
  {
    name: "refactor_code",
    description:
      "Suggests and applies refactoring to improve code structure, readability, and maintainability.",
    systemPrompt: `You are an expert software architect. Refactor the provided code to improve:

1. **Readability**: Clear variable names, proper formatting
2. **Maintainability**: Good structure, separation of concerns
3. **Performance**: Efficient algorithms and patterns
4. **Best Practices**: Modern patterns for the language

Output the refactored code with brief comments explaining major changes.`,
  },
  z.object({
    code: z.string().describe("The code to refactor"),
    language: z.string().describe("Programming language"),
    goals: z.string().optional().describe("Specific refactoring goals"),
  }),
  (input) => {
    let prompt = `Refactor this ${input.language} code`;
    if (input.goals) prompt += ` with focus on: ${input.goals}`;
    prompt += `:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\``;
    return prompt;
  },
);

// Code Search/Analysis Subagent
export const codeAnalysisSubagent = createSubagentTool(
  {
    name: "analyze_code",
    description:
      "Analyzes code structure, dependencies, and provides insights about the codebase.",
    systemPrompt: `You are a code analysis expert. Analyze the provided code and provide insights on:

1. **Structure**: Overall organization and patterns used
2. **Dependencies**: External and internal dependencies
3. **Complexity**: Code complexity assessment
4. **Architecture**: Design patterns and architectural decisions
5. **Suggestions**: Areas for improvement

Be analytical and precise.`,
  },
  z.object({
    code: z.string().describe("The code to analyze"),
    language: z.string().optional().describe("Programming language"),
    focus: z.string().optional().describe("Specific aspect to focus on"),
  }),
  (input) => {
    let prompt = `Analyze this ${input.language || "code"}`;
    if (input.focus) prompt += ` focusing on: ${input.focus}`;
    prompt += `:\n\n\`\`\`${input.language || ""}\n${input.code}\n\`\`\``;
    return prompt;
  },
);

// Planning Subagent
export const planningSubagent = createSubagentTool(
  {
    name: "create_plan",
    description: "Creates a detailed implementation plan for a coding task.",
    systemPrompt: `You are a senior software architect. Create a detailed, actionable implementation plan.

Your plan should include:
1. **Overview**: Brief summary of the approach
2. **Steps**: Numbered, specific implementation steps
3. **Files**: Files that need to be created or modified
4. **Dependencies**: Required packages or tools
5. **Testing**: How to verify the implementation
6. **Risks**: Potential issues and mitigations

Be specific and practical.`,
  },
  z.object({
    task: z.string().describe("The task to plan"),
    context: z.string().optional().describe("Current codebase context"),
    constraints: z
      .string()
      .optional()
      .describe("Any constraints or requirements"),
  }),
  (input) => {
    let prompt = `Create an implementation plan for: ${input.task}`;
    if (input.context) prompt += `\n\nContext:\n${input.context}`;
    if (input.constraints) prompt += `\n\nConstraints:\n${input.constraints}`;
    return prompt;
  },
);

// Register all built-in subagents
registerSubagent(codeReviewSubagent);
registerSubagent(testGeneratorSubagent);
registerSubagent(docGeneratorSubagent);
registerSubagent(refactoringSubagent);
registerSubagent(codeAnalysisSubagent);
registerSubagent(planningSubagent);

// ============================================================================
// Subagent Tool for Main Agent
// ============================================================================

export const delegateToSubagentSchema = z.object({
  subagent: z
    .enum([
      "code_review",
      "generate_tests",
      "generate_docs",
      "refactor_code",
      "analyze_code",
      "create_plan",
    ])
    .describe("Name of the subagent to delegate to"),
  input: z
    .record(z.string(), z.unknown())
    .describe("Input parameters for the subagent"),
});

export async function delegateToSubagent(
  subagentName: string,
  input: Record<string, unknown>,
  parentContext?: string,
): Promise<SubagentResult> {
  const subagent = getSubagent(subagentName);

  if (!subagent) {
    return {
      success: false,
      output: "",
      error: `Unknown subagent: ${subagentName}. Available: ${Array.from(subagentRegistry.keys()).join(", ")}`,
    };
  }

  try {
    // Validate input
    const validatedInput = subagent.inputSchema.parse(input);
    return await subagent.execute(validatedInput, parentContext);
  } catch (error: any) {
    return {
      success: false,
      output: "",
      error: error.message || String(error),
    };
  }
}

// ============================================================================
// Export Subagent Tool Definition for Main Agent
// ============================================================================

export const subagentToolDefinition = tool({
  description: `Delegate a specialized task to a subagent. Available subagents:
- code_review: Reviews code for bugs, security issues, and improvements
- generate_tests: Generates unit tests for code
- generate_docs: Generates documentation (JSDoc, docstrings, README)
- refactor_code: Refactors code for better structure and readability
- analyze_code: Analyzes code structure and provides insights
- create_plan: Creates detailed implementation plans

Use this to get expert help on specific tasks without doing everything yourself.`,
  inputSchema: z.object({
    subagent: z
      .enum([
        "code_review",
        "generate_tests",
        "generate_docs",
        "refactor_code",
        "analyze_code",
        "create_plan",
      ])
      .describe("Name of the subagent to delegate to"),
    input: z
      .record(z.string(), z.unknown())
      .describe("Input parameters for the subagent (varies by subagent)"),
  }),
  execute: async ({ subagent, input }) => {
    const result = await delegateToSubagent(
      subagent,
      input as Record<string, unknown>,
    );

    if (result.success) {
      return {
        success: true,
        subagent,
        output: result.output,
        usage: result.usage,
      };
    } else {
      return {
        success: false,
        subagent,
        error: result.error,
      };
    }
  },
});
