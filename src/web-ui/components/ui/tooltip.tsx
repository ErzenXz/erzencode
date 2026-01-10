import * as React from "react";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const Tooltip = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const TooltipTrigger = ({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) => {
  if (!asChild) return <>{children}</>;
  return <>{children}</>;
};

export const TooltipContent = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "none" }}>{children}</span>
);
