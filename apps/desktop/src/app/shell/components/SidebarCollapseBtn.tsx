import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@shared/ui/button";
import { cn } from '@shared/lib/utils';
import { useNavSidebarSettings } from '@shared/hooks';

interface SidebarCollapseBtnProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarCollapseBtn({ collapsed, onToggle }: SidebarCollapseBtnProps) {
  const { settings } = useNavSidebarSettings();
  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/5';
  const textClass = isBgLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/5";

  return (
    <div className={cn("border-t shrink-0", borderClass, "p-3")}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg text-xs font-medium transition-all duration-200",
          textClass
        )}
        title={collapsed ? "توسيع الشريط" : "طي الشريط"}
      >
        {collapsed ? (
          <PanelLeftOpen className="w-4 h-4" />
        ) : (
          <>
            <PanelLeftClose className="w-4 h-4" />
            <span>طي</span>
          </>
        )}
      </Button>
    </div>
  );
}
