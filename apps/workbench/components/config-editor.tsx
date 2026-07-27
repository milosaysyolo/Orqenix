// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// CONFIG EDITOR — Monaco-based editor for markdown/JSON config files.
// ============================================================================

'use client';

import * as React from 'react';
import Editor from '@monaco-editor/react';

interface ConfigEditorProps {
  value: string;
  onChange: (val: string) => void;
  language?: 'markdown' | 'json';
  readOnly?: boolean;
  height?: number;
}

export function ConfigEditor({ value, onChange, language = 'markdown', readOnly = false, height = 400 }: ConfigEditorProps) {
  return (
    <div className="rounded-[7px] border border-[var(--line)] overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange(val ?? '')}
        theme="light"
        options={{
          readOnly,
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          renderLineHighlight: 'gutter',
          padding: { top: 8, bottom: 8 },
          bracketPairColorization: { enabled: false },
          guides: { bracketPairs: false },
        }}
      />
    </div>
  );
}
