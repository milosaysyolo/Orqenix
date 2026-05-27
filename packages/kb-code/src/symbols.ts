import Parser from "web-tree-sitter";
import { parseSource, type SupportedLanguage } from "./parser.js";

export interface Symbol {
  name: string;
  kind: "function" | "class" | "method" | "interface" | "variable";
  startLine: number;
  endLine: number;
  language: SupportedLanguage;
}

const QUERY_NODE_TYPES: Record<SupportedLanguage, Record<string, Symbol["kind"]>> = {
  typescript: {
    function_declaration: "function",
    class_declaration: "class",
    method_definition: "method",
    interface_declaration: "interface",
  },
  javascript: {
    function_declaration: "function",
    class_declaration: "class",
    method_definition: "method",
  },
  python: {
    function_definition: "function",
    class_definition: "class",
  },
  go: {
    function_declaration: "function",
    method_declaration: "method",
    type_declaration: "interface",
  },
};

function findNameNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (!c) continue;
    if (c.type === "identifier" || c.type === "property_identifier" || c.type === "type_identifier") {
      return c;
    }
  }
  return null;
}

function walk(node: Parser.SyntaxNode, visitor: (n: Parser.SyntaxNode) => void) {
  visitor(node);
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c) walk(c, visitor);
  }
}

export async function extractSymbols(
  source: string,
  lang: SupportedLanguage
): Promise<Symbol[]> {
  const tree = await parseSource(source, lang);
  const kinds = QUERY_NODE_TYPES[lang];
  const out: Symbol[] = [];

  walk(tree.rootNode, (n) => {
    const kind = kinds[n.type];
    if (!kind) return;
    const nameNode = findNameNode(n);
    if (!nameNode) return;
    out.push({
      name: nameNode.text,
      kind,
      startLine: n.startPosition.row,
      endLine: n.endPosition.row,
      language: lang,
    });
  });

  return out;
}

// Legacy API
const QUERIES: Record<string, string> = {
  typescript: `
    (function_declaration name: (identifier) @name) @function
    (class_declaration    name: (type_identifier) @name) @class
    (interface_declaration name: (type_identifier) @name) @interface
    (type_alias_declaration name: (type_identifier) @name) @type
    (method_definition name: (property_identifier) @name) @method
    (lexical_declaration (variable_declarator name: (identifier) @name)) @const
    (enum_declaration name: (identifier) @name) @enum
  `,
  python: `
    (function_definition name: (identifier) @name) @function
    (class_definition    name: (identifier) @name) @class
  `,
  rust: `
    (function_item name: (identifier) @name) @function
    (struct_item   name: (type_identifier) @name) @class
    (enum_item     name: (type_identifier) @name) @enum
    (trait_item    name: (type_identifier) @name) @interface
  `,
  go: `
    (function_declaration name: (identifier) @name) @function
    (method_declaration   name: (field_identifier) @name) @method
    (type_declaration (type_spec name: (type_identifier) @name)) @type
  `,
};

export function extractSymbolsLegacy(parser: Parser, source: string, lang: string): Symbol[] {
  const tree = parser.parse(source);
  const queryStr = QUERIES[lang];
  if (!queryStr) return [];
  const query = parser.getLanguage().query(queryStr);
  const matches = query.matches(tree.rootNode);
  const symbols: Symbol[] = [];

  for (const m of matches) {
    const node = m.captures.find(c => c.name !== "name")?.node;
    const name = m.captures.find(c => c.name === "name")?.node.text;
    if (!node || !name) continue;
    const kind = m.captures.find(c => c.name !== "name")!.name as Symbol["kind"];
    symbols.push({
      kind,
      name,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      language: lang as SupportedLanguage,
    });
  }
  return symbols;
}
