/**
 * Type declarations for web-tree-sitter module.
 */

declare module "web-tree-sitter" {
  export interface Point {
    row: number;
    column: number;
  }

  export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    children: SyntaxNode[];
    childCount: number;
    namedChildren: SyntaxNode[];
    namedChildCount: number;
    firstChild: SyntaxNode | null;
    lastChild: SyntaxNode | null;
    firstNamedChild: SyntaxNode | null;
    lastNamedChild: SyntaxNode | null;
    nextSibling: SyntaxNode | null;
    previousSibling: SyntaxNode | null;
    nextNamedSibling: SyntaxNode | null;
    previousNamedSibling: SyntaxNode | null;
    parent: SyntaxNode | null;
    childForFieldName(name: string): SyntaxNode | null;
    child(index: number): SyntaxNode | null;
    namedChild(index: number): SyntaxNode | null;
    descendantForIndex(index: number): SyntaxNode;
    descendantForPosition(position: Point): SyntaxNode;
    toString(): string;
  }

  export interface Tree {
    rootNode: SyntaxNode;
    copy(): Tree;
    delete(): void;
    edit(edit: Edit): void;
  }

  export interface Edit {
    startIndex: number;
    oldEndIndex: number;
    newEndIndex: number;
    startPosition: Point;
    oldEndPosition: Point;
    newEndPosition: Point;
  }

  export interface Language {
    // Opaque type for language
  }

  export interface Parser {
    parse(input: string, oldTree?: Tree): Tree;
    setLanguage(language: Language | null): void;
    getLanguage(): Language | null;
    setTimeoutMicros(timeout: number): void;
    getTimeoutMicros(): number;
    reset(): void;
    delete(): void;
  }

  export interface InitOptions {
    locateFile?: (scriptName: string, scriptDirectory: string) => string;
  }

  interface ParserClass {
    new (): Parser;
    init(options?: InitOptions): Promise<void>;
    Language: {
      load(path: string): Promise<Language>;
    };
  }

  const Parser: ParserClass;
  export default Parser;
  export { Parser };
}
