/**
 * Tree-Sitter AST-based code chunker.
 * Extracts semantic code blocks (functions, classes, etc.) from source files.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type {
  SupportedLanguage,
  ParsedChunk,
  ChunkType,
  ProgressCallback,
} from "./types.js";

/**
 * Node types to extract for each language.
 */
const CHUNK_NODE_TYPES: Partial<Record<SupportedLanguage, string[]>> = {
  typescript: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "arrow_function",
    "function_expression",
    "interface_declaration",
    "type_alias_declaration",
    "export_statement",
  ],
  javascript: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "arrow_function",
    "function_expression",
    "export_statement",
  ],
  python: [
    "function_definition",
    "class_definition",
    "async_function_definition",
  ],
  go: [
    "function_declaration",
    "method_declaration",
    "type_declaration",
  ],
  rust: [
    "function_item",
    "impl_item",
    "struct_item",
    "enum_item",
    "trait_item",
    "mod_item",
  ],
  c: [
    "function_definition",
    "struct_specifier",
    "enum_specifier",
  ],
  cpp: [
    "function_definition",
    "class_specifier",
    "struct_specifier",
    "namespace_definition",
  ],
  java: [
    "method_declaration",
    "class_declaration",
    "interface_declaration",
    "constructor_declaration",
  ],
  ruby: [
    "method",
    "class",
    "module",
    "singleton_method",
  ],
  bash: [
    "function_definition",
  ],
};

/**
 * Map node types to chunk types.
 */
const NODE_TO_CHUNK_TYPE: Record<string, ChunkType> = {
  // Functions
  function_declaration: "function",
  function_definition: "function",
  async_function_definition: "function",
  function_item: "function",
  arrow_function: "function",
  function_expression: "function",
  method_declaration: "method",
  method_definition: "method",
  method: "method",
  singleton_method: "method",
  constructor_declaration: "method",
  // Classes
  class_declaration: "class",
  class_definition: "class",
  class_specifier: "class",
  class: "class",
  // Structs
  struct_specifier: "struct",
  struct_item: "struct",
  // Interfaces
  interface_declaration: "interface",
  // Types
  type_alias_declaration: "type",
  type_declaration: "type",
  // Enums
  enum_specifier: "enum",
  enum_item: "enum",
  // Traits
  trait_item: "trait",
  // Impl
  impl_item: "impl",
  // Modules
  mod_item: "module",
  module: "module",
  namespace_definition: "module",
  // Generic
  export_statement: "block",
};

/**
 * Minimum chunk size in characters.
 */
const MIN_CHUNK_SIZE = 50;

/**
 * Maximum chunk size in characters.
 */
const MAX_CHUNK_SIZE = 8000;

/**
 * Context lines to include before a chunk.
 */
const CONTEXT_LINES_BEFORE = 2;

/**
 * Tree-sitter parser interface (from web-tree-sitter).
 */
interface TreeSitterParser {
  parse(input: string): TreeSitterTree;
  setLanguage(language: TreeSitterLanguage): void;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeSitterNode[];
  childCount: number;
  namedChildren: TreeSitterNode[];
  firstChild: TreeSitterNode | null;
  lastChild: TreeSitterNode | null;
  nextSibling: TreeSitterNode | null;
  previousSibling: TreeSitterNode | null;
  parent: TreeSitterNode | null;
  childForFieldName(name: string): TreeSitterNode | null;
}

interface TreeSitterLanguage {
  // Opaque type
}

/**
 * Global parser instance.
 */
let webTreeSitterModule: any = null;
let ParserCtor: any = null;
let parserInstance: TreeSitterParser | null = null;
let loadedLanguages: Map<SupportedLanguage, TreeSitterLanguage> = new Map();
let initPromise: Promise<void> | null = null;

/**
 * Language WASM file paths (relative to node_modules).
 */
const LANGUAGE_WASM_PATHS: Partial<Record<SupportedLanguage, string>> = {
  javascript: "tree-sitter-javascript",
  typescript: "tree-sitter-typescript/typescript",
  python: "tree-sitter-python",
  go: "tree-sitter-go",
  rust: "tree-sitter-rust",
  c: "tree-sitter-c",
  cpp: "tree-sitter-cpp",
  java: "tree-sitter-java",
  ruby: "tree-sitter-ruby",
  bash: "tree-sitter-bash",
};

/**
 * Initializes the tree-sitter parser.
 */
async function initParser(): Promise<void> {
  if (parserInstance) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamic import of web-tree-sitter.
      // v0.26+ ships as ESM with a named `Parser` export (no default).
      const mod: any = await import("web-tree-sitter");
      const Parser = mod?.Parser ?? mod?.default;

      if (!Parser || typeof Parser.init !== "function") {
        throw new TypeError(
          `web-tree-sitter did not export a Parser with init(); exports: ${Object.keys(mod ?? {}).join(", ")}`
        );
      }

      // Make WASM resolution robust across local installs and global linking.
      const require = createRequire(import.meta.url);
      const wasmFile = require.resolve("web-tree-sitter/web-tree-sitter.wasm");

      await Parser.init({
        locateFile(filename: string) {
          return filename.endsWith(".wasm") ? wasmFile : filename;
        },
      });

      webTreeSitterModule = mod;
      ParserCtor = Parser;
      parserInstance = new ParserCtor() as unknown as TreeSitterParser;
    } catch (error) {
      console.error("Failed to initialize tree-sitter:", error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Loads a language for tree-sitter.
 */
async function loadLanguage(language: SupportedLanguage): Promise<TreeSitterLanguage | null> {
  if (loadedLanguages.has(language)) {
    return loadedLanguages.get(language)!;
  }

  const wasmPath = LANGUAGE_WASM_PATHS[language];
  if (!wasmPath) {
    return null;
  }

  try {
    await initParser();
    
    // Try to find the WASM file
    const possiblePaths = [
      path.join(process.cwd(), "node_modules", wasmPath, `tree-sitter-${language}.wasm`),
      path.join(process.cwd(), "node_modules", `tree-sitter-${language}`, `tree-sitter-${language}.wasm`),
    ];

    for (const wasmFile of possiblePaths) {
      try {
        await fs.access(wasmFile);
        const lang = await webTreeSitterModule.Language.load(wasmFile);
        loadedLanguages.set(language, lang);
        return lang;
      } catch {
        // Try next path
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to load language ${language}:`, error);
    return null;
  }
}

/**
 * Extracts the symbol name from a node.
 */
function extractSymbolName(node: TreeSitterNode, language: SupportedLanguage): string | undefined {
  // Common patterns for finding the name
  const nameFieldNames = ["name", "identifier"];
  
  for (const fieldName of nameFieldNames) {
    const nameNode = node.childForFieldName(fieldName);
    if (nameNode) {
      return nameNode.text;
    }
  }

  // Fallback: look for identifier in children
  for (const child of node.namedChildren) {
    if (child.type === "identifier" || child.type === "property_identifier") {
      return child.text;
    }
  }

  return undefined;
}

/**
 * Recursively finds all chunks in a syntax tree.
 */
function findChunks(
  node: TreeSitterNode,
  nodeTypes: string[],
  language: SupportedLanguage,
  sourceLines: string[]
): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];

  if (nodeTypes.includes(node.type)) {
    const startLine = node.startPosition.row + 1; // Convert to 1-based
    const endLine = node.endPosition.row + 1;
    const code = node.text;

    // Skip if too small
    if (code.length >= MIN_CHUNK_SIZE) {
      const chunkType = NODE_TO_CHUNK_TYPE[node.type] ?? "block";
      const symbolName = extractSymbolName(node, language);

      // If chunk is too large, we might need to split it
      if (code.length <= MAX_CHUNK_SIZE) {
        chunks.push({
          code,
          startLine,
          endLine,
          chunkType,
          symbolName,
        });
      } else {
        // For very large chunks, try to extract inner chunks
        for (const child of node.namedChildren) {
          chunks.push(...findChunks(child, nodeTypes, language, sourceLines));
        }
        
        // If no inner chunks found, add as file chunk
        if (chunks.length === 0) {
          chunks.push({
            code: code.slice(0, MAX_CHUNK_SIZE),
            startLine,
            endLine,
            chunkType: "file",
            symbolName,
          });
        }
      }
    }
  } else {
    // Recurse into children
    for (const child of node.namedChildren) {
      chunks.push(...findChunks(child, nodeTypes, language, sourceLines));
    }
  }

  return chunks;
}

/**
 * Parses a file and extracts semantic chunks using tree-sitter.
 */
export async function parseFile(
  filePath: string,
  language: SupportedLanguage
): Promise<ParsedChunk[]> {
  const content = await fs.readFile(filePath, "utf-8");
  return parseContent(content, language);
}

/**
 * Parses content and extracts semantic chunks.
 */
export async function parseContent(
  content: string,
  language: SupportedLanguage
): Promise<ParsedChunk[]> {
  // Check if AST parsing is supported for this language
  const nodeTypes = CHUNK_NODE_TYPES[language];
  
  if (!nodeTypes) {
    // Fall back to line-based chunking
    return lineBasedChunking(content);
  }

  try {
    // Try to load the language
    const lang = await loadLanguage(language);
    
    if (!lang || !parserInstance) {
      // Fall back to line-based chunking
      return lineBasedChunking(content);
    }

    // Parse the content
    parserInstance.setLanguage(lang);
    const tree = parserInstance.parse(content);
    const sourceLines = content.split("\n");

    // Extract chunks
    const chunks = findChunks(tree.rootNode, nodeTypes, language, sourceLines);

    // If no chunks found, fall back to line-based
    if (chunks.length === 0) {
      return lineBasedChunking(content);
    }

    return chunks;
  } catch (error) {
    // On any error, fall back to line-based chunking
    console.error(`Tree-sitter parsing failed for ${language}:`, error);
    return lineBasedChunking(content);
  }
}

/**
 * Line-based chunking for unsupported languages.
 * Splits content into chunks of approximately MAX_CHUNK_SIZE characters.
 */
function lineBasedChunking(content: string): ParsedChunk[] {
  const lines = content.split("\n");
  const chunks: ParsedChunk[] = [];
  
  let currentChunk: string[] = [];
  let currentSize = 0;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 for newline

    if (currentSize + lineSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk
      const code = currentChunk.join("\n");
      if (code.length >= MIN_CHUNK_SIZE) {
        chunks.push({
          code,
          startLine,
          endLine: startLine + currentChunk.length - 1,
          chunkType: "block",
        });
      }

      // Start new chunk
      currentChunk = [line];
      currentSize = lineSize;
      startLine = i + 1;
    } else {
      currentChunk.push(line);
      currentSize += lineSize;
    }
  }

  // Save remaining chunk
  if (currentChunk.length > 0) {
    const code = currentChunk.join("\n");
    if (code.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        code,
        startLine,
        endLine: startLine + currentChunk.length - 1,
        chunkType: "block",
      });
    }
  }

  // If content is small, return as single chunk
  if (chunks.length === 0 && content.length >= MIN_CHUNK_SIZE) {
    chunks.push({
      code: content,
      startLine: 1,
      endLine: lines.length,
      chunkType: "file",
    });
  }

  return chunks;
}

/**
 * Code chunker class for processing multiple files.
 */
export class CodeChunker {
  private onProgress?: ProgressCallback;

  constructor(onProgress?: ProgressCallback) {
    this.onProgress = onProgress;
  }

  /**
   * Parses a file and returns chunks.
   */
  async parseFile(filePath: string, language: SupportedLanguage): Promise<ParsedChunk[]> {
    return parseFile(filePath, language);
  }

  /**
   * Parses multiple files.
   */
  async parseFiles(
    files: Array<{ path: string; language: SupportedLanguage }>
  ): Promise<Map<string, ParsedChunk[]>> {
    const results = new Map<string, ParsedChunk[]>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      this.onProgress?.({
        phase: "parsing",
        current: i,
        total: files.length,
        currentFile: file.path,
      });

      try {
        const chunks = await this.parseFile(file.path, file.language);
        results.set(file.path, chunks);
      } catch (error) {
        // Log error but continue
        console.error(`Failed to parse ${file.path}:`, error);
        results.set(file.path, []);
      }
    }

    this.onProgress?.({
      phase: "parsing",
      current: files.length,
      total: files.length,
      message: `Parsed ${files.length} files`,
    });

    return results;
  }
}

/**
 * Checks if tree-sitter is available.
 */
export async function isTreeSitterAvailable(): Promise<boolean> {
  try {
    await initParser();
    return parserInstance !== null;
  } catch {
    return false;
  }
}
