// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , SkillBrowser , browse + invoke skills from UI

"use client";

import * as React from "react";
import { Play, Zap } from "lucide-react";
import { Card, CardContent, Badge, Button } from "@orqenix/ui-primitives";

export interface SkillBrowserData {
  name: string;
  version: string;
  description: string;
  external_agent_compat: string[];
}

export interface SkillBrowserProps {
  skills: SkillBrowserData[];
  onInvoke?: (name: string) => void;
}

export function SkillBrowser({ skills, onInvoke }: SkillBrowserProps): React.ReactElement {
  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Zap className="w-10 h-10 mx-auto mb-2 opacity-40" aria-hidden />
        No skills installed.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <Card key={skill.name}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{skill.name}</span>
                <Badge variant="secondary" className="text-xs">
                  v{skill.version}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {skill.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onInvoke?.(skill.name)}
              className="gap-1"
            >
              <Play className="w-3.5 h-3.5" aria-hidden /> Invoke
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
