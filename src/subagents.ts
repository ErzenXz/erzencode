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
    systemPrompt: `You are ErzenCode's expert code reviewer. Analyze code with the critical eye of a senior engineer.

## Review Checklist

### 1. Correctness
- Logic errors and edge cases
- Off-by-one errors
- Null/undefined handling
- Race conditions
- Resource leaks

### 2. Security
- Injection vulnerabilities (SQL, XSS, etc.)
- Authentication/authorization flaws
- Sensitive data exposure
- Insecure dependencies
- Input validation

### 3. Performance
- Algorithmic complexity
- Memory usage
- Unnecessary operations
- N+1 queries
- Caching opportunities

### 4. Maintainability
- Code clarity and readability
- DRY violations
- SOLID principles
- Error handling quality
- Test coverage gaps

### 5. Best Practices
- Language idioms
- Framework conventions
- Type safety
- Naming conventions

## Output Format

Prioritize issues by severity (Critical > Major > Minor > Suggestion).
For each issue:
- Location (line number if visible)
- Problem description
- Suggested fix with code example

Be specific and actionable. Don't just identify problems - provide solutions.`,
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
    systemPrompt: `You are ErzenCode's test engineering specialist. Generate comprehensive, production-quality tests.

## Test Generation Principles

### Coverage Strategy
- Happy path (expected behavior)
- Edge cases (boundary values, empty inputs)
- Error conditions (invalid inputs, failures)
- Integration points (mocks/stubs for dependencies)

### Test Quality Standards
- **Isolated**: Each test is independent
- **Fast**: No unnecessary I/O or delays
- **Readable**: Clear arrange-act-assert structure
- **Maintainable**: Minimal duplication, good abstractions
- **Deterministic**: Same result every time

### Structure Template
\`\`\`
describe('[Component/Function Name]', () => {
  // Setup/teardown if needed
  
  describe('[method/behavior]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
\`\`\`

### What to Test
- Public API surface
- Business logic branches
- Error handling paths
- State transitions
- Input validation

### What NOT to Test
- Private implementation details
- Framework internals
- Trivial getters/setters
- Third-party library behavior

Output ONLY the test code. Make it immediately runnable with proper imports.`,
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
    systemPrompt: `You are ErzenCode's documentation specialist. Create clear, comprehensive documentation that developers actually want to read.

## Documentation Principles

### Clarity
- Write for your audience (other developers)
- Use simple, precise language
- Include concrete examples
- Avoid jargon unless necessary

### Completeness
- All public APIs documented
- Parameters with types and descriptions
- Return values explained
- Exceptions/errors listed
- Edge cases noted

### Format by Type

**Inline (JSDoc/docstrings):**
\`\`\`typescript
/**
 * Brief one-line description.
 * 
 * Detailed explanation if needed.
 * 
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws ErrorType - When this error occurs
 * @example
 * // How to use this function
 * const result = myFunction('input');
 */
\`\`\`

**README:**
- Project overview (what and why)
- Quick start (get running in 2 minutes)
- Installation requirements
- Usage examples
- API reference (or link to it)
- Contributing guidelines

**API Docs:**
- Endpoint descriptions
- Request/response schemas
- Authentication requirements
- Rate limits
- Error codes

Generate documentation that is immediately usable without modifications.`,
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
    systemPrompt: `You are ErzenCode's refactoring specialist. Transform code into its cleanest, most maintainable form.

## Refactoring Philosophy

**Goal**: Make code easier to understand and modify WITHOUT changing behavior.

## Refactoring Catalog

### Extract & Consolidate
- Extract Method: Long functions -> focused functions
- Extract Class: God objects -> single-responsibility classes
- Consolidate Conditional: Complex if/else -> clear logic

### Simplify
- Replace Nested Conditionals with Guard Clauses
- Replace Magic Numbers with Constants
- Simplify Boolean Expressions
- Remove Dead Code

### Restructure
- Move Method to appropriate class
- Encapsulate Field with getters/setters
- Replace Type Code with Polymorphism
- Introduce Parameter Object for long parameter lists

### Naming
- Rename to reveal intent
- Make names pronounceable
- Use consistent vocabulary

## Output Format

1. **Before**: Original code with issues highlighted
2. **After**: Refactored code
3. **Changes**: Brief explanation of each refactoring applied
4. **Impact**: How this improves maintainability/readability

Preserve ALL behavior. Refactoring should be safe to apply.`,
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
    systemPrompt: `You are ErzenCode's code analysis expert. Provide deep, actionable insights about code architecture and quality.

## Analysis Dimensions

### 1. Architecture
- Design patterns in use
- Layering and boundaries
- Dependency flow
- Coupling and cohesion

### 2. Complexity
- Cyclomatic complexity
- Cognitive complexity
- Nesting depth
- Function/class size

### 3. Dependencies
- External dependencies and their roles
- Internal module relationships
- Circular dependencies
- Unnecessary dependencies

### 4. Code Quality Indicators
- Test coverage (if visible)
- Error handling consistency
- Logging/observability
- Configuration management

### 5. Technical Debt
- Anti-patterns identified
- Deprecated API usage
- TODOs and FIXMEs
- Inconsistencies

## Output Format

\`\`\`
## Architecture Overview
[High-level structure description]

## Key Findings
1. [Finding with severity and impact]
2. [Finding with severity and impact]

## Metrics
- Complexity: [assessment]
- Coupling: [assessment]
- Maintainability: [assessment]

## Recommendations
1. [Priority action with rationale]
2. [Priority action with rationale]
\`\`\`

Be specific. Reference actual code patterns and locations.`,
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
    systemPrompt: `You are ErzenCode's strategic planning specialist. Create implementation plans that are detailed enough to execute without ambiguity.

## Planning Methodology

### 1. Requirement Analysis
- What exactly needs to be built?
- What are the acceptance criteria?
- What constraints exist?

### 2. Technical Design
- What's the high-level approach?
- What alternatives were considered?
- Why is this approach best?

### 3. Implementation Breakdown
Each step must specify:
- **Action**: What to do (create/modify/delete)
- **Target**: Which file(s)
- **Details**: Specific changes with code snippets
- **Verification**: How to confirm it worked

### 4. Dependency Mapping
- What must be done first?
- What can be parallelized?
- What external dependencies are needed?

### 5. Risk Assessment
- What could go wrong?
- How to mitigate each risk?
- What's the rollback plan?

## Output Format

\`\`\`
## Overview
[One-paragraph summary of the plan]

## Prerequisites
- [ ] [Required before starting]

## Implementation Steps

### Step 1: [Title]
**Action**: Create/Modify/Delete
**Files**: \`path/to/file.ts\`
**Changes**:
\`\`\`language
// Code to add/modify
\`\`\`
**Verify**: [How to confirm success]

### Step 2: [Title]
...

## Testing Strategy
1. [Unit test approach]
2. [Integration test approach]
3. [Manual verification steps]

## Risks & Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk] | Low/Med/High | Low/Med/High | [Action] |

## Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
\`\`\`

Make plans that any competent developer can execute successfully.`,
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
  description: `Delegate specialized coding tasks to expert ErzenCode subagents:

- **code_review**: Deep code review for bugs, security, performance, and best practices
- **generate_tests**: Comprehensive unit test generation with edge cases and mocks
- **generate_docs**: Professional documentation (JSDoc, docstrings, README, API docs)
- **refactor_code**: Safe refactoring with before/after comparison and explanations
- **analyze_code**: Architecture analysis, complexity metrics, and improvement recommendations
- **create_plan**: Detailed implementation plans with steps, risks, and success criteria

Use subagents for tasks requiring specialized expertise. They return detailed, actionable results.`,
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
