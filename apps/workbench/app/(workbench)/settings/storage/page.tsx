// SPDX-License-Identifier: Apache-2.0
// Settings → Storage , configure KB backends, compression levels, and embedding models

"use client";

import { Database, Archive, HardDrive } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Label,
  Switch,
  Slider,
} from "@orqenix/ui-primitives";

export default function SettingsStoragePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Storage</h2>
        <p className="text-sm text-muted-foreground">
          Configure KB backends, compression levels, and embedding models.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" aria-hidden />
              Knowledge Base Backend
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              P6 locked
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow label="Code KB backend" phaseLock="P6">
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option selected>sqlite (default)</option>
              <option>lmdb</option>
              <option>kuzu</option>
              <option>lance</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Chat KB enabled"
            description="ChatKB stores conversation history"
            phaseLock="P3"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Code KB enabled"
            description="CodeKB stores code snippets, ASTs, symbols"
            phaseLock="P3"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Decision KB enabled"
            description="DecisionKB stores architectural decisions"
            phaseLock="P3"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Lesson KB enabled"
            description="LessonKB stores lessons learned"
            phaseLock="P3"
          >
            <Switch defaultChecked />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" aria-hidden />
              Compression
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              P3 locked
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Diff-only storage enabled"
            description="BLAKE3 + zstd-delta diff storage"
            phaseLock="P3"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow label="Snapshot every N deltas" description="Default 20" phaseLock="P3">
            <Slider defaultValue={[20]} min={10} max={50} step={1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">20</span>
          </SettingRow>

          <SettingRow
            label="zstd level T1-T3 (default)"
            description="Default 3 (fast)"
            phaseLock="P3"
          >
            <Slider defaultValue={[3]} min={1} max={9} step={1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">3</span>
          </SettingRow>

          <SettingRow label="zstd level T4 (archive)" description="Default 19 (max)" phaseLock="P3">
            <Slider defaultValue={[19]} min={9} max={22} step={1} className="w-48" />
            <span className="text-sm text-muted-foreground ml-3">19</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" aria-hidden />
              Embedding Model
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              P8 / P4
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <SettingRow label="Model" phaseLock="P8">
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option selected>bge-small-v1.5 (default)</option>
              <option>OpenAI ada-002</option>
              <option>Voyage embed-v2</option>
              <option>Cohere embed-v3</option>
              <option>Custom...</option>
            </select>
          </SettingRow>

          <div className="mt-6">
            <SettingRow
              label="Embedding quantization"
              description="int8 reduces storage 4x vs float32"
              phaseLock="P8"
            >
              <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                <option>float32</option>
                <option selected>int8 (default)</option>
                <option>binary</option>
              </select>
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
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center shrink-0">{children}</div>
    </div>
  );
}
