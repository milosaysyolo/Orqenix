import type Parser from "web-tree-sitter";

export interface Symbol {
  kind: "function" | "class" | "interface" | "type" | "method" | "const" | "enum";
  name: string;
  startLine: number;
  endLine: number;
  signature: string;
}

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

export function extractSymbols(parser: Parser, source: string, lang: string): Symbol[] {
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
      signature: source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 200)),
    });
  }
  return symbols;
}
