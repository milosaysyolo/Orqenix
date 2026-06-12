// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , PluginConfigForm , schema-driven settings form

'use client';

import * as React from 'react';
import { Label, Input, Switch, Button } from '@orqenix/ui-primitives';

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface PluginConfigFormProps {
  schema: { properties?: Record<string, JsonSchemaProperty> };
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
}

export function PluginConfigForm({ schema, values, onChange, onSave }: PluginConfigFormProps): React.ReactElement {
  const props = schema.properties ?? {};
  return (
    <div className="space-y-4">
      {Object.entries(props).map(([key, prop]) => (
        <div key={key} className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">{key}</Label>
            {prop.description && <p className="text-xs text-muted-foreground mt-0.5">{prop.description}</p>}
          </div>
          <div className="shrink-0">
            {prop.type === 'boolean' ? (
              <Switch
                checked={Boolean(values[key] ?? prop.default)}
                onCheckedChange={(v: boolean) => onChange(key, v)}
              />
            ) : prop.enum ? (
              <select
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={String(values[key] ?? prop.default ?? '')}
                onChange={(e) => onChange(key, e.target.value)}
              >
                {prop.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <Input
                className="w-48"
                value={String(values[key] ?? prop.default ?? '')}
                onChange={(e) => onChange(key, e.target.value)}
              />
            )}
          </div>
        </div>
      ))}
      <div className="pt-2">
        <Button onClick={onSave}>Save Configuration</Button>
      </div>
    </div>
  );
}
