// SPDX-License-Identifier: Apache-2.0
// Settings → Self-Learning , observer, detection thresholds, promotion settings

'use client';

import { Sparkles, AlertTriangle, Brain, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Label, Switch, Slider } from '@orqenix/ui-primitives';

export default function SettingsSelfLearningPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Self-Learning</h2>
        <p className="text-sm text-muted-foreground">
          Observer captures workflow patterns to suggest skills. Opt-out at any level.
        </p>
      </div>

      {/* Prominent banner per CR v8.0 ADR-E-010 / INV-17 */}
      <Card className="border-orqenix-amber/30 bg-orqenix-amber/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-orqenix-amber mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Self-Learning Observer , Opt-out enabled by default
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Orqenix observes your workflow (tool calls, file edits, outcomes) to detect
                recurring patterns and suggest them as reusable skills. PII is filtered.
                You can disable observation at session, branch, or project level at any time.
                Cross-project sharing requires explicit approval per ADR-E-011.
              </p>
              <p className="text-xs text-orqenix-amber font-medium mt-2">
                Per CR v8.0 INV-17: Observer is enabled by default with this prominent banner.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" aria-hidden />
              Observer
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Observer enabled (project level)"
            description="Default: opt-out (ON). Captures observation events for pattern detection."
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="PII filter applied"
            description="Privacy filters from CR v7.3 D7.15 always applied"
            phaseLock="P7"
          >
            <Switch defaultChecked disabled />
          </SettingRow>

          <SettingRow
            label="First-launch banner shown"
            description="Show observer notification on Workbench first launch"
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" aria-hidden />
              Detection Thresholds
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Min occurrences for promotion"
            description="Pattern must repeat at least N times. Default 5."
            phaseLock="P8"
          >
            <Slider defaultValue={[5]} min={3} max={20} step={1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">5</span>
          </SettingRow>

          <SettingRow
            label="Min success rate"
            description="Pattern outcome must succeed at least X% of the time. Default 80%."
            phaseLock="P8"
          >
            <Slider defaultValue={[0.8]} min={0.5} max={1.0} step={0.05} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">80%</span>
          </SettingRow>

          <SettingRow
            label="Cooldown hours"
            description="Cool down between candidate re-detection for same pattern. Default 24h."
            phaseLock="P8"
          >
            <Slider defaultValue={[24]} min={6} max={72} step={1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">24h</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" aria-hidden />
              Cross-Scope Sharing
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Cross-session sharing within branch"
            description="Default: opt-out (ON). Parallel sessions share observations."
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Cross-branch sharing within project"
            description="Default: opt-out (ON). Patterns from sibling branches surface."
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Cross-project sharing"
            description="Default: opt-in (OFF). Candidates show but never share without approval (ADR-E-011)."
            phaseLock="P8"
          >
            <Switch />
          </SettingRow>
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
