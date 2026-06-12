// SPDX-License-Identifier: Apache-2.0
// @orqenix/ui-primitives, Button primitive
//
// 6 variants: default, secondary, outline, ghost, destructive, link
// 4 sizes: sm, default, lg, icon

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-xs',
        default: 'h-9 px-4 py-2',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * If true, renders the child element with button styling instead of a <button>.
   * Useful for wrapping <a> or Next.js <Link> with Button appearance.
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    // For asChild, we expect exactly one child element. Clone it with button classes.
    if (asChild) {
      const child = React.Children.only(props.children);
      if (!React.isValidElement(child)) {
        throw new Error(
          '@orqenix/ui-primitives Button asChild requires exactly one valid React element child'
        );
      }
      return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
        className: cn(buttonVariants({ variant, size }), (child as React.ReactElement<{ className?: string }>).props.className, className),
      });
    }

    return (
      <button
        type={type ?? 'button'}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
