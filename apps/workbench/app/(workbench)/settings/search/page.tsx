// SPDX-License-Identifier: Apache-2.0
// Settings → Search , hybrid search weights, noise reduction, prompt rewriter

'use client';

import { Search, Filter, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Label, Switch, Slider } from '@orqenix/ui-primitives';

export default function SettingsSearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Search</h2>
        <p className="text-sm text-muted-foreground">
          Configure hybrid search weights, noise reduction, and prompt rewriter.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" aria-hidden />
              Hybrid Search Weights
            </CardTitle>
            <Badge variant="outline" className="text-xs">P4 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow label="Vector weight" description="Default 0.5" phaseLock="P4">
            <Slider defaultValue={[0.5]} min={0} max={1} step={0.05} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">0.50</span>
          </SettingRow>

          <SettingRow label="BM25 weight" description="Default 0.3" phaseLock="P4">
            <Slider defaultValue={[0.3]} min={0} max={1} step={0.05} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">0.30</span>
          </SettingRow>

          <SettingRow label="Trigram weight" description="Default 0.1" phaseLock="P4">
            <Slider defaultValue={[0.1]} min={0} max={1} step={0.05} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">0.10</span>
          </SettingRow>

          <SettingRow label="Recency weight" description="Default 0.1" phaseLock="P4">
            <Slider defaultValue={[0.1]} min={0} max={1} step={0.05} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">0.10</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" aria-hidden />
              Noise Reduction (RTK)
            </CardTitle>
            <Badge variant="outline" className="text-xs">P4 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="RTK noise reduction enabled"
            description="89% noise reduction in search results"
            phaseLock="P4"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="RTK aggressive mode"
            description="Stricter noise filtering (may miss some relevant results)"
            phaseLock="P4"
          >
            <Switch />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" aria-hidden />
              Prompt Rewriter
            </CardTitle>
            <Badge variant="outline" className="text-xs">P4 locked</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Model"
            description="Default: Qwen 2.5 7B (local). BYOK alternatives available."
            phaseLock="P4"
          >
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option selected>qwen2.5-7b-instruct (default, local)</option>
              <option>OpenAI gpt-4o-mini (BYOK)</option>
              <option>Anthropic claude-3-haiku (BYOK)</option>
              <option>Google gemini-1.5-flash (BYOK)</option>
              <option>DeepSeek v3 (BYOK)</option>
            </select>
          </SettingRow>

          <div className="mt-6">
            <SettingRow
              label="Rewriter timeout"
              description="Max time for prompt rewrite (default 5000ms)"
              phaseLock="P4"
            >
              <Slider defaultValue={[5000]} min={1000} max={10000} step={500} className="w-48" />
              <span className="text-sm text-muted-foreground ml-3">5000ms</span>
            </SettingRow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  description,
  phaseLock,
  children,
}: {
  label: string;
  description?: string;
  phaseLock?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {phaseLock && (
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {phaseLock}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center shrink-0">{children}</div>
    </div>
  );
}
