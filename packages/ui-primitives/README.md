# @orqenix/ui-primitives

> Apache-2.0 shared UI primitives for Orqenix Workbench and Cloud Web Control Plane.

## Status

- **Phase**: 8 Foundation (D8.α.2)
- **Charter gate**: G61-07, G61-08, G61-09
- **Consumers**: `@orqenix/workbench` (D8.α.1), `apps/cloud-web` (Phase 7 D7.5)

## Install

```bash
pnpm add @orqenix/ui-primitives
```

## Usage

```tsx
import { Button, Card, CardContent, Badge } from "@orqenix/ui-primitives";
import "@orqenix/ui-primitives/styles.css";

export function MyComponent() {
  return (
    <Card>
      <CardContent>
        <Badge variant="default">v0.8.0</Badge>
        <Button variant="default" size="lg">
          Open Workbench
        </Button>
      </CardContent>
    </Card>
  );
}
```

## What's included

### 12 primitives

| Component                                             | Variants                                              | Radix-based |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------- |
| `Button`                                              | default, secondary, outline, ghost, destructive, link | No          |
| `Card` (+ CardHeader, CardTitle, CardContent)         | -                                                     | No          |
| `Badge`                                               | default, secondary, outline, destructive              | No          |
| `Input`                                               | (text, email, url, password, etc.)                    | No          |
| `Label`                                               | -                                                     | Yes         |
| `Switch`                                              | -                                                     | Yes         |
| `Slider`                                              | -                                                     | Yes         |
| `Dialog` (+ DialogContent, DialogHeader, DialogTitle) | -                                                     | Yes         |
| `Tabs` (+ TabsList, TabsTrigger, TabsContent)         | -                                                     | Yes         |
| `Toast` (+ Toaster)                                   | default, destructive                                  | Yes         |
| `Select` (+ SelectTrigger, SelectContent, SelectItem) | -                                                     | Yes         |
| `Separator`                                           | horizontal, vertical                                  | Yes         |

### Design tokens

OKLCH-based color palette with semantic naming. Light and dark themes built-in.
Tokens exposed as CSS custom properties and TypeScript exports:

```ts
import { tokens } from "@orqenix/ui-primitives/tokens";

console.log(tokens.colors.orqenix.emerald); // OKLCH color
```

### Utility helpers

- `cn(...classes)` - Conditional className merger (clsx + tailwind-merge)

## Design philosophy

- **shadcn/ui patterns**: Copy + paste style, no runtime bloat
- **Radix primitives**: Accessibility built in (WCAG 2.2 AA)
- **OKLCH colors**: Perceptually uniform, future-proof for wide-gamut displays
- **Tree-shakable**: Only imported primitives included in bundle
- **Type-safe**: Strict TypeScript with exact optional property types

## Compatibility

- React 18.3+ or React 19
- Tailwind CSS 3.4+
- Modern browsers with CSS custom properties + OKLCH support
  (Chrome 111+, Safari 16.4+, Firefox 113+)
- Falls back gracefully to HSL in older browsers via `@supports`

## License

Apache-2.0, see ./LICENSE

Built on shadcn/ui (MIT) and Radix UI (MIT). See package.json dependencies.
