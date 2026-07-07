import { readFileSync, writeFileSync } from "fs";

const file = "packages/ui-primitives/src/components/toast.tsx";
let c = readFileSync(file, "utf-8");

// Fix 1: split at }function boundaries
c = c.replace(/;}(\s*)(function\s+)/g, ";\n}\n\n$2");
c = c.replace(/}(\s*)(function\s+)/g, "}\n\n$2");

// Fix 2: strip corrupted U+FFFD bytes and split at section comments
c = c.replace(/\uFFFD+/g, "");

// Fix 3: split collapsed // section comments from each other and from following code
c = c.replace(/\/\/[^\n]*?\/\//g, (m) => m.replace(/\/\//g, "\n//").replace(/\n{2,}/g, "\n"));

// Fix 4: ensure Toaster function return is properly formatted
c = c.replace(/function Toaster\(\) \{/g, "\nfunction Toaster() {");
c = c.replace(/return \(    <ToastProvider>/g, "return (\n    <ToastProvider>");
c = c.replace(/>;}/g, ">\n  );\n}");

writeFileSync(file, c, "utf-8");
console.log("Fixed toast.tsx");
