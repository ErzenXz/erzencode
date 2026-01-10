import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary";
};

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
      variant === "default" && "bg-primary text-primary-foreground border-transparent",
      variant === "secondary" && "bg-muted text-muted-foreground border-transparent",
      className
    )}
    {...props}
  />
);
