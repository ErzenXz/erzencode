import * as React from "react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export const InputGroup = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex w-full flex-col rounded-xl border border-input bg-background",
      className
    )}
    {...props}
  />
);

export type InputGroupTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const InputGroupTextarea = ({
  className,
  ...props
}: InputGroupTextareaProps) => (
  <textarea
    className={cn(
      "w-full resize-none bg-transparent p-3 text-sm outline-none",
      className
    )}
    {...props}
  />
);

export type InputGroupAddonProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "block-start" | "block-end";
};

export const InputGroupAddon = ({ className, ...props }: InputGroupAddonProps) => (
  <div className={cn("flex items-center p-2", className)} {...props} />
);

export type InputGroupButtonProps = ButtonProps;

export const InputGroupButton = (props: InputGroupButtonProps) => (
  <Button {...props} />
);

export const InputGroupAddonText = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn(className)} {...props} />
);
