import * as React from "react";

export const HoverCard = ({
  children,
}: {
  children: React.ReactNode;
  openDelay?: number;
  closeDelay?: number;
}) => <>{children}</>;

export const HoverCardTrigger = ({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) => <>{children}</>;

export const HoverCardContent = ({
  children,
}: {
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
}) => <>{children}</>;
