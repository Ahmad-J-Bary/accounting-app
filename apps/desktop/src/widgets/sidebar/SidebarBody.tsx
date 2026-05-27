import { type ReactNode } from "react";
import { useSidebarSettings } from '@shared/hooks/useSidebarSettings';
import { cn } from '@shared/lib/utils';

interface SidebarBodyProps {
  children: ReactNode;
  className?: string;
}

export function SidebarBody({ children, className }: SidebarBodyProps) {
  const { getPaddingClass, getSpacingClass, getFontSizeClass } = useSidebarSettings();

  return (
    <div className={cn("flex-1 overflow-y-auto custom-scrollbar text-right", getPaddingClass(), getSpacingClass(), getFontSizeClass(), className)}>
      {children}
    </div>
  );
}
