import { Layers, X } from "lucide-react";
import { Button } from "@shared/ui/button";
import { cn } from '@shared/lib/utils';
import { useNavSidebarSettings } from '@shared/hooks';

interface SidebarLogoProps {
  collapsed: boolean;
  iconOnly: boolean;
  onClose?: () => void;
}

export function SidebarLogo({ collapsed, iconOnly, onClose }: SidebarLogoProps) {
  const { settings } = useNavSidebarSettings();
  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/5';
  const textClass = isBgLight ? 'text-slate-800' : 'text-white';
  const subtextClass = isBgLight ? 'text-slate-500' : 'text-slate-400';
  const logoHeight = collapsed ? "h-14" : (settings.navDensity === 'compact' ? "h-14" : settings.navDensity === 'spacious' ? "h-20" : "h-16");

  return (
    <div className={cn(
      "flex items-center border-b shrink-0",
      borderClass,
      collapsed ? "justify-center px-2" : "gap-3 px-5",
      logoHeight,
    )}>
      <div className={cn(
        "rounded-md bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0",
        collapsed ? "w-9 h-9" : "w-9 h-9",
      )}>
        <Layers className="w-5 h-5 text-white" />
      </div>
      {!collapsed && !iconOnly && (
        <>
          <div className="flex-1 min-w-0">
            <div className={cn("font-bold text-sm leading-tight truncate", textClass)}>نظام الإدارة المتكامل</div>
            <div className={cn("text-[10px] font-medium truncate", subtextClass)}>المحاسبة والمخزون</div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className={cn("shrink-0", isBgLight ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "text-slate-400 hover:bg-white/10 hover:text-white")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
