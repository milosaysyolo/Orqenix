// SPDX-License-Identifier: Apache-2.0
// @orqenix/ui-primitives, Public API surface
//
// Phase 8 Foundation (D8.α.2)
// Charter gates: G61-07, G61-08, G61-09
//
// All primitives are Apache-2.0 and designed for reuse across:
//   - @orqenix/workbench (OSS local Web UI)
//   - apps/cloud-web (Cloud Web Control Plane, future refactor)
//   - Third-party plugins (visualization, dashboard)

// ─────────────────────────────────────────────────────────────────────────
// Design tokens (separate subpath export for tree-shaking)
// ─────────────────────────────────────────────────────────────────────────

export { tokens } from "./design-tokens";
export type { Tokens, ColorScale, BrandColors, SemanticColors } from "./design-tokens";

// ─────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────

export { cn } from "./lib/cn";

// ─────────────────────────────────────────────────────────────────────────
// Primitives, re-export everything from each component module
// ─────────────────────────────────────────────────────────────────────────

// Form primitives
export { Button, buttonVariants } from "./components/button";
export type { ButtonProps } from "./components/button";

export { Input } from "./components/input";
export type { InputProps } from "./components/input";

export { Label } from "./components/label";

export { Switch } from "./components/switch";

export { Slider } from "./components/slider";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./components/select";

// Layout primitives
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card";

export { Badge, badgeVariants } from "./components/badge";
export type { BadgeProps } from "./components/badge";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Toaster,
  useToast,
} from "./components/toast";
export type { ToastProps, ToastActionElement } from "./components/toast";

export { Separator } from "./components/separator";
