import { cn } from '@shared/lib/utils';
import pkg from "../../../../package.json";
import { useNavSidebarSettings } from '@shared/hooks';

interface SidebarFooterProps {
  collapsed: boolean;
  iconOnly: boolean;
  verticalAppearance?: 'light' | 'dark';
}

export function SidebarFooter({ collapsed, iconOnly, verticalAppearance }: SidebarFooterProps) {
  const { settings } = useNavSidebarSettings();
  if (collapsed && iconOnly) return null;

  const lightBgs = ['bg-white', 'bg-slate-50', 'bg-gray-50', 'bg-zinc-50'];
  const isBgLight = verticalAppearance
    ? verticalAppearance === 'light'
    : lightBgs.includes(settings.navBackground);
  const borderClass = isBgLight ? 'border-slate-200' : 'border-[hsl(var(--sidebar-border))]';
  const textClass = isBgLight ? 'text-slate-500 font-semibold' : 'text-[hsl(var(--sidebar-foreground))] opacity-60';

  return (
    <div className={cn(
      "border-t shrink-0",
      borderClass,
      collapsed ? "p-2 flex justify-center" : "p-4 flex items-center gap-2"
    )}>
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
      <span className={cn(
        "text-[10px] font-medium tracking-wide",
        textClass,
        collapsed ? "hidden" : ""
      )}>
        الإصدار {pkg.version}
      </span>
    </div>
  );
}
