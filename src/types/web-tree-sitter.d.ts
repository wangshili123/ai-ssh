declare module 'web-tree-sitter/tree-sitter' {
  export interface SyntaxNode {
    type: string;
    text: string;
    children: SyntaxNode[];
    firstChild?: SyntaxNode;
    lastChild?: SyntaxNode;
  }

  export interface Tree {
    rootNode: SyntaxNode;
  }

  export interface Language {
    nodeTypeForId(typeId: number): string;
    nodeTypeId(type: string): number;
  }

  export default class Parser {
    static init(options?: { locateFile?: (path: string, prefix: string) => string }): Promise<void>;
    constructor();
    setLanguage(language: Language): void;
    parse(input: string): Tree;
    reset(): void;
    getLanguage(): Language;
    static Language: {
      load(wasmBuffer: Uint8Array): Promise<Language>;
    };
  }

  export namespace Parser {
    export interface SyntaxNode {
      type: string;
      text: string;
      children: SyntaxNode[];
      firstChild?: SyntaxNode;
      lastChild?: SyntaxNode;
    }
  }
} 