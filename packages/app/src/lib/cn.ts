import { clsx } from "clsx"

import type { ClassValue } from "clsx"

/** Joins class names. Callers never pass conflicting utilities, so no merge step is needed. */
export function cn(...inputs: ClassValue[]): string {
    return clsx(inputs)
}
