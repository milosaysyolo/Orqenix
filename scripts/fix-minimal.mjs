import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const SPDX = "// SPDX-License-Identifier: Apache-2.0";

function isCollapsed(content) {
  return content.split('\n').every(l => l.trim() === '' || l.trim().startsWith('//') || l.trim().startsWith('*'));
}

function fix(file) {
  let content = readFileSync(file, 'utf-8');
  if (!content.startsWith(SPDX) || !isCollapsed(content)) return false;

  const rest = content.slice(SPDX.length);

  // Step 1: Split into logical lines at // boundaries
  const lines = [];
  let buf = '';
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i], next = rest[i+1] || '';
    if (ch === '/' && next === '/' && buf.length > 0 && buf[buf.length-1] !== '\n' && buf[buf.length-1] !== '/') {
      lines.push(buf);
      // Check for //// (empty comment followed by next comment)
      if (rest[i+2] === '/' && rest[i+3] === '/') {
        lines.push('//');
        buf = '//';
        i += 3;
      } else {
        buf = '//';
        i++;
      }
      continue;
    }
    buf += ch;
  }
  if (buf) lines.push(buf);

  // Step 2: Find where comment block ends and code starts
  // Code starts with: import, export, /** JSDoc, abstract class, class Name, function Name
  const codeStart = /\b(import\s+|export\s+|\/\*\*|abstract\s+class|class\s+\w+[\s\{]|function\s+\w+)/;

  let header = [];
  let codeRaw = '';
  let inCode = false;

  for (const line of lines) {
    if (inCode) { codeRaw += line; continue; }

    const trimmed = line.trim();
    if (!trimmed.startsWith('//') && trimmed) {
      codeRaw = line;
      inCode = true;
      continue;
    }

    // Check if code is appended to this comment line
    const m = line.match(codeStart);
    if (m && m.index > 0) {
      header.push(line.slice(0, m.index).replace(/[^a-zA-Z0-9)\]}\/\n]+$/, ''));
      codeRaw = line.slice(m.index);
      inCode = true;
      continue;
    }

    header.push(line);
  }

  // Step 3: Build header
  let result = SPDX + '\n';
  for (const h of header) {
    const t = h.trim();
    if (!t || t === '//') result += '//\n';
    else if (t.startsWith('//')) result += t + '\n';
    else result += h + '\n';
  }

  // Step 4: Process code section
  if (codeRaw) {
    let code = codeRaw;

    // Split inline // comments: find code keywords after 3+ spaces
    // Pattern: `// comment text      keyword...` -> `// comment text\nkeyword...`
    const inlineKw = /\b(return|const|let|var|if|for|while|switch|try|catch|finally|throw|this\.|await|async|function|class)\b/;
    
    // Process // comments in code: extract code after comment text
    code = code.replace(/\/\/[^\n]*/g, (match) => {
      // Find first code keyword after 3+ spaces in the match
      const kwMatch = match.match(/(\s{3,})(${inlineKw.source})/);
      if (kwMatch) {
        const idx = match.indexOf(kwMatch[1]);
        return match.slice(0, idx) + '\n' + match.slice(idx + kwMatch[1].length);
      }
      // No code keyword — check for patterns like `text.import`, `text.export`
      const altMatch = match.match(/([.!?)\]])\s*(import\s|export\s|\/\*\*)/);
      if (altMatch) {
        return match.slice(0, match.indexOf(altMatch[1]) + 1) + '\n' + match.slice(match.indexOf(altMatch[1]) + 1 + altMatch[1].length);
      }
      return match;
    });

    // Split at ; followed by statement
    code = code.replace(/;\s*(?=[a-zA-Z_])/g, ';\n');

    // Remove trailing non-code from comment-code boundary
    code = code.replace(/^[^a-zA-Z0-9_\/\{\[\(@"']+/, '');

    result += '\n' + code;
  }

  writeFileSync(file, result, 'utf-8');
  return true;
}

// Fix all
const files = globSync('packages/*/src/**/*.{ts,tsx}', { nodir: true });
let fixed = 0;
for (const f of files) {
  if (fix(f)) { fixed++; console.log(`Fixed: ${f}`); }
}
console.log(`\nFixed ${fixed} files.`);
