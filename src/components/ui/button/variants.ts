/**
 * Shared button styling - the single source of truth for both <Button>
 * (a real button) and <LinkButton> (an anchor styled as a button).
 *
 * Terminal recipe: square, 1px boundary, text labels, color as signal.
 * No radius, shadow, gradient or glowing ring.
 */
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "secondary-destructive"
  | "outline";
export type ButtonSize = "xs" | "sm" | "base" | "lg";
export type ButtonShape = "base" | "square" | "circle";

export const buttonBase =
  "group inline-flex w-max shrink-0 cursor-pointer select-none items-center justify-center border font-medium whitespace-nowrap no-underline transition-colors duration-100 focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-foreground bg-foreground text-background hover:border-foreground-strong hover:bg-foreground-strong",
  secondary:
    "border-line-strong bg-transparent text-foreground hover:border-foreground",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-hover",
  destructive:
    "border-danger bg-transparent text-danger hover:bg-danger hover:text-background",
  "secondary-destructive":
    "border-line bg-transparent text-danger hover:border-danger",
  outline:
    "border-line bg-transparent text-foreground hover:border-line-strong",
};

// Rectangular sizing (shape="base").
export const buttonSizeText: Record<ButtonSize, string> = {
  xs: "gap-1 px-2 py-1 text-xs",
  sm: "gap-1 px-2 py-1 text-xs",
  base: "gap-1.5 px-3 py-1 text-sm",
  lg: "gap-2 px-4 py-1.5 text-md",
};

// Square sizing (icon-only slots are not used; kept API-compatible).
export const buttonSizeCompact: Record<ButtonSize, string> = {
  xs: "size-7",
  sm: "size-8",
  base: "size-9",
  lg: "size-10",
};

export const buttonIconSize: Record<ButtonSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-3.5 w-3.5",
  base: "h-4 w-4",
  lg: "h-[1.125rem] w-[1.125rem]",
};

export interface ButtonVariantsOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}

/** Compose the base + variant + size/shape classes for a button-shaped element. */
export function buttonVariants({
  variant = "secondary",
  size = "base",
  shape = "base",
}: ButtonVariantsOptions = {}): string {
  // Square geometry: `circle` keeps the same box; there is no pill radius.
  const dims =
    shape === "base"
      ? buttonSizeText[size]
      : cn(buttonSizeCompact[size], "p-0");
  return cn(buttonBase, buttonVariantClasses[variant], dims);
}
