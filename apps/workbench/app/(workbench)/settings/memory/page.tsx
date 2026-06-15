// SPDX-License-Identifier: Apache-2.0
// Settings → Memory , configure memory hierarchy, injection, compression, branch policies

'use client';

import { Brain, Layers, Compass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Label, Switch, Slider } from '@orqenix/ui-primitives';

export default function SettingsMemoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Memory</h2>
        <p className="text-sm text-muted-foreground">
          Configure Memory × Knowledge Matrix, hierarchy boosts, and compression policies.
        </p>
      </div>

      {/* BASIC MODE settings (~10 settings) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" aria-hidden />
              Hierarchy Injection
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Hierarchy-aware injection"
            description="Query memory across session → branch → project in parallel"
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Session boost"
            description="Weight multiplier for session-level results (default 1.5)"
            phaseLock="P8"
          >
            <Slider defaultValue={[1.5]} min={0.5} max={3.0} step={0.1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">1.5</span>
          </SettingRow>

          <SettingRow
            label="Branch boost"
            description="Weight multiplier for branch-level results (default 1.2)"
            phaseLock="P8"
          >
            <Slider defaultValue={[1.2]} min={0.5} max={3.0} step={0.1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">1.2</span>
          </SettingRow>

          <SettingRow
            label="Project boost"
            description="Weight multiplier for project-level results (default 1.0)"
            phaseLock="P8"
          >
            <Slider defaultValue={[1.0]} min={0.5} max={3.0} step={0.1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">1.0</span>
          </SettingRow>

          <SettingRow
            label="Subagent return boost"
            description="Boost multiplier for protected subagent returns (default 10.0)"
            phaseLock="P8"
          >
            <Slider defaultValue={[10.0]} min={1.0} max={20.0} step={0.5} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">10.0</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Compass className="w-5 h-5" aria-hidden />
              Injection Strategy
            </CardTitle>
            <Badge variant="outline" className="text-xs">P2 locked</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Strategy"
            description="A=Aggressive / B=Medium (default) / C=Conservative / D=Minimal / E=None"
            phaseLock="P2"
          >
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option>A - Aggressive</option>
              <option selected>B - Medium (default)</option>
              <option>C - Conservative</option>
              <option>D - Minimal</option>
              <option>E - None</option>
            </select>
          </SettingRow>
        </CardContent>
      </Card>

      {/* ADVANCED MODE settings (~30 more) , revealed conditionally */}
      <details className="border border-border rounded-lg" data-advanced>
        <summary className="px-6 py-4 cursor-pointer hover:bg-muted/50 font-medium">
          Advanced (~30 more settings)
        </summary>
        <div className="px-6 border-t border-border space-y-6">
          <p className="text-sm text-muted-foreground">
            Advanced settings include: anti-noise threshold, cluster cosine, recency boost weights,
            tie boost weights, branch copy strategy, clone tiers, compression strategies, cooldown,
            multi-agent team session default, max subagent depth, distiller cap, and more.
            Full implementation in D8.α.5 (Settings Registry).
          </p>
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-2" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Advanced setting scaffold , wired in D8.α.5
            </p>
          </div>
        </div>
      </details>
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
