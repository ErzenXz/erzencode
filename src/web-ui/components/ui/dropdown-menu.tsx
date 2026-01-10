import * as React from "react";

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const DropdownMenuTrigger = ({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) => (
  <>{children}</>
);

export const DropdownMenuContent = ({
  children,
}: {
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
}) => <>{children}</>;

export const DropdownMenuItem = ({
  children,
  onSelect,
  ...props
}: {
  children: React.ReactNode;
  onSelect?: (e: Event) => void;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={() => {
        // shim
        onSelect?.(new Event("select"));
      }}
      {...props}
    >
      {children}
    </div>
  );
};
