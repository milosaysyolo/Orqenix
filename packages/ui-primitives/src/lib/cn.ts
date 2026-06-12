// SPDX-License-Identifier: Apache-2.0
// @orqenix/ui-primitives, Class name utility
//
// `cn()` merges multiple class strings, conditionally including them,
// and de-duplicates conflicting Tailwind classes (e.g., px-2 vs px-4).
//
// Usage:
//   cn('px-2 py-1', condition && 'bg-blue-500', 'text-white')
//   cn('px-2', 'px-4')  // → 'px-4' (later wins)

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditionally combine class names with Tailwind-aware de-duplication.
 *
 * @param inputs Class values: strings, arrays, objects, false/null/undefined are dropped
 * @returns Merged class string
 *
 * @example
 *   cn('px-2 py-1', 'bg-blue-500', { 'text-white': isActive })
 *   cn('px-2', condition && 'px-4')  // resolves Tailwind conflict
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
