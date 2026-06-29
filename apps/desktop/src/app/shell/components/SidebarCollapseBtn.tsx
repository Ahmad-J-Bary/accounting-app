import { ArrowLeftToLine, ArrowRightFromLine } from "lucide-react";
import { Button } from "@shared/ui/button";
import { cn } from '@shared/lib/utils';
import { useNavSidebarSettings } from '@shared/hooks';

interface SidebarCollapseBtnProps {
  collapsed: boolean;
  onToggle: () => void;
  verticalAppearance?: 'light' | 'dark';
}

export function SidebarCollapseBtn({ collapsed, onToggle, verticalAppearance }: SidebarCollapseBtnProps) {
  const { settings } = useNavSidebarSettings();
  const lightBgs = ['bg-white', 'bg-slate-50', 'bg-gray-50', 'bg-zinc-50'];
  const isBgLight = verticalAppearance
    ? verticalAppearance === 'light'
    : lightBgs.includes(settings.navBackground);
  const borderClass = isBgLight ? 'border-slate-200' : 'border-[hsl(var(--sidebar-border))]';
  const textClass = isBgLight
    ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
    : "text-[hsl(var(--sidebar-foreground))] opacity-60 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]";

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
          <ArrowLeftToLine className="w-4 h-4" />
        ) : (
          <>
            <ArrowRightFromLine className="w-4 h-4" />
            <span>طي</span>
          </>
        )}
      </Button>
    </div>
  );
}