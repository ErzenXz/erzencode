import * as React from "react";

import { cn } from "@/lib/utils";

export type ButtonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export const ButtonGroup = ({
  className,
  orientation = "horizontal",
  ...props
}: ButtonGroupProps) => (
  <div
    className={cn(
      "inline-flex",
      orientation === "horizontal" ? "flex-row" : "flex-col",
      className
    )}
    {...props}
  />
);

export type ButtonGroupTextProps = React.HTMLAttributes<HTMLDivElement>;

export const ButtonGroupText = ({ className, ...props }: ButtonGroupTextProps) => (
  <div className={cn("px-2 text-xs", className)} {...props} />
);
