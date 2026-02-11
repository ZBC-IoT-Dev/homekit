import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function middleTruncate(
  value: string,
  startLength = 11,
  endLength = 4,
): string {
  if (value.length <= startLength + endLength + 3) {
    return value
  }

  return `${value.slice(0, startLength)}...${value.slice(-endLength)}`
}
