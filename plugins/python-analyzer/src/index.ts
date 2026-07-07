// SPDX-License-Identifier: Apache-2.0
// Reference code-analyzer plugin: Python analysis.
//
// Reference uses regex extraction; production uses tree-sitter-python for an
// accurate AST.

interface AnalyzeInput {
  source: string;
}

interface AnalyzeOutput {
  functions: string[];
  classes: string[];
  imports: string[];
}

export async function invoke(input: AnalyzeInput): Promise<AnalyzeOutput> {
  const functions: string[] = [];
  const classes: string[] = [];
  const imports: string[] = [];

  for (const line of input.source.split("\n")) {
    const fnMatch = /^\s*def\s+(\w+)\s*\(/.exec(line);
    if (fnMatch) functions.push(fnMatch[1]!);

    const classMatch = /^\s*class\s+(\w+)/.exec(line);
    if (classMatch) classes.push(classMatch[1]!);

    const importMatch = /^\s*(?:import|from)\s+([\w.]+)/.exec(line);
    if (importMatch) imports.push(importMatch[1]!);
  }

  return { functions, classes, imports };
}
