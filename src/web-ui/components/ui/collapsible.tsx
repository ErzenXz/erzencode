import * as React from "react";

import { cn } from "@/lib/utils";

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(
  null
);

export type CollapsibleProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const Collapsible = ({
  className,
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: CollapsibleProps) => {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? !!open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open: currentOpen, setOpen }}>
      <div
        className={cn("group", className)}
        data-state={currentOpen ? "open" : "closed"}
        {...props}
      />
    </CollapsibleContext.Provider>
  );
};

export type CollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const CollapsibleTrigger = ({
  className,
  onClick,
  ...props
}: CollapsibleTriggerProps) => {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) {
    throw new Error("CollapsibleTrigger must be used within Collapsible");
  }

  return (
    <button
      className={cn("w-full", className)}
      onClick={(e) => {
        ctx.setOpen(!ctx.open);
        onClick?.(e);
      }}
      type="button"
      {...props}
    />
  );
};

export type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CollapsibleContent = ({
  className,
  ...props
}: CollapsibleContentProps) => {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) {
    throw new Error("CollapsibleContent must be used within Collapsible");
  }

  if (!ctx.open) {
    return null;
  }

  return <div className={cn(className)} {...props} />;
};
