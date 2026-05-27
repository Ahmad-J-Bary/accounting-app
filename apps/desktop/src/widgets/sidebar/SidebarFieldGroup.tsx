import { type ReactNode } from "react";
import { cn } from '@shared/lib/utils';

interface SidebarFieldGroupProps {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function SidebarFieldGroup({
  children,
  columns = 1,
  className
}: SidebarFieldGroupProps) {
  return (
    <div className={cn("grid gap-4", columns === 2 ? "grid-cols-2" : "grid-cols-1", className)}>
      {children}
    </div>
  );
}
