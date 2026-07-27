// SPDX-License-Identifier: Apache-2.0
// @orqenix/ui-primitives, Input primitive
//
// Standard <input> element with consistent styling, focus ring, disabled state.
// Supports all native input types: text, email, url, password, number, search, tel, etc.

import * as React from "react";
import { cn } from "../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Optional error state. When true, shows destructive border + ring.
   */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type ?? "text"}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
