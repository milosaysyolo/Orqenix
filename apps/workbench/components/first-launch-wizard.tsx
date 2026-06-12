// SPDX-License-Identifier: Apache-2.0
// First-launch wizard , Welcome + Observer banner + Done
// Per CR v8.0 G61-16: first-launch wizard introduces Workbench + asks about observer

'use client';

import { useState } from 'react';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Check,
  Network,
  Package,
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@orqenix/ui-primitives';

type Step = 'welcome' | 'observer' | 'done';

interface FirstLaunchWizardProps {
  onComplete: () => void;
}

export function FirstLaunchWizard({ onComplete }: FirstLaunchWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [observerEnabled, setObserverEnabled] = useState(true); // opt-out default

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-xl">
        {/* Welcome step */}
        {step === 'welcome' && (
          <CardContent className="p-8">
            <div className="flex justify-center mb-6">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orqenix-emerald/15 text-orqenix-emerald font-bold text-3xl"
                aria-hidden
              >
                Ω
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2">
              Welcome to Orqenix Workbench
            </h1>
            <p className="text-center text-muted-foreground mb-6">
              Your local-first knowledge fabric for AI coding agents
            </p>

            <div className="space-y-4 mb-8">
              <FeatureRow
                icon={Brain}
                title="3-level memory hierarchy"
                description="Project → Branch → Session, full Memory × Knowledge matrix at every level"
              />
              <FeatureRow
                icon={Network}
                title="14 plugin kinds"
                description="MCP server + 7 agent bindings (Claude Code, Cursor, Codex, OpenCode, Cline, Aider, Continue)"
              />
              <FeatureRow
                icon={Sparkles}
                title="Self-learning observer"
                description="Detects workflow patterns and suggests skills, opt-out at any level"
              />
              <FeatureRow
                icon={Package}
                title="Marketplace + Normalization"
                description="Full CRUD + 14 input/output adapters for cross-platform skill portability"
              />
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <Button
                onClick={() => setStep('observer')}
                className="w-full justify-center gap-2"
                size="lg"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Phase 8 Foundation , v0.8.0-alpha.1 , Apache-2.0
              </p>
            </div>
          </CardContent>
        )}

        {/* Observer step (prominent banner per INV-17) */}
        {step === 'observer' && (
          <CardContent className="p-8">
            <div className="flex items-start gap-4 mb-6">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-orqenix-amber/15 text-orqenix-amber shrink-0"
                aria-hidden
              >
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Self-Learning Observer</h2>
                <p className="text-sm text-muted-foreground">
                  Opt-out by default with prominent notification per CR v8.0 INV-17
                </p>
              </div>
            </div>

            <div className="bg-orqenix-amber/5 border border-orqenix-amber/30 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium mb-2">
                What the observer does
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Captures workflow patterns: tool calls, file edits, outcomes</li>
                <li>• Detects recurring sequences ({'>'} 5 occurrences, {'>'} 80% success)</li>
                <li>• Suggests skills you can promote to your skill library</li>
                <li>• PII is filtered before storage (Phase 7 privacy filters)</li>
                <li>• Cross-project sharing requires explicit approval (ADR-E-011)</li>
              </ul>
            </div>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="observer-choice"
                  checked={observerEnabled}
                  onChange={() => setObserverEnabled(true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Enable observer (recommended)</span>
                    <Badge variant="default" className="text-xs">
                      Default
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Improves Orqenix over time with workflow pattern detection
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="observer-choice"
                  checked={!observerEnabled}
                  onChange={() => setObserverEnabled(false)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Disable observer</span>
                    <Badge variant="secondary" className="text-xs">
                      Privacy-first
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No workflow patterns captured. Can re-enable anytime in Settings → Self-Learning.
                  </p>
                </div>
              </label>
            </div>

            <p className="text-xs text-center text-muted-foreground mb-6">
              You can change this any time at <strong>Settings → Self-Learning</strong>
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('welcome')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => {
                  // Persist observer setting to localStorage for now
                  // D8.α.5 Settings Registry will wire this to the real settings layer
                  localStorage.setItem(
                    'orqenix-workbench:observer-enabled',
                    observerEnabled ? 'true' : 'false'
                  );
                  setStep('done');
                }}
                className="flex-1 justify-center gap-2"
              >
                {observerEnabled ? 'Enable observer' : 'Disable observer'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        )}

        {/* Done step */}
        {step === 'done' && (
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orqenix-emerald/15 text-orqenix-emerald"
                aria-hidden
              >
                <Check className="w-8 h-8" />
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-3">You're all set</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Workbench is running at <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm">http://localhost:27420</code>
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8 text-left">
              <Card className="p-3">
                <Brain className="w-5 h-5 text-orqenix-emerald mb-2" aria-hidden />
                <p className="text-sm font-medium">Memory</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Browse hierarchical memory
                </p>
              </Card>
              <Card className="p-3">
                <Sparkles className="w-5 h-5 text-orqenix-amber mb-2" aria-hidden />
                <p className="text-sm font-medium">Self-Learning</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Observer is{' '}
                  <strong>
                    {observerEnabled ? 'enabled' : 'disabled'}
                  </strong>
                </p>
              </Card>
              <Card className="p-3">
                <Package className="w-5 h-5 text-orqenix-violet mb-2" aria-hidden />
                <p className="text-sm font-medium">Marketplace</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Discover and install plugins
                </p>
              </Card>
              <Card className="p-3">
                <Network className="w-5 h-5 text-orqenix-emerald mb-2" aria-hidden />
                <p className="text-sm font-medium">Mesh</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View links and capabilities
                </p>
              </Card>
            </div>

            <Button
              onClick={onComplete}
              className="w-full justify-center gap-2"
              size="lg"
            >
              Open Workbench
              <ChevronRight className="w-4 h-4" />
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              Press <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd> any time to open the command palette
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground shrink-0"
        aria-hidden
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
