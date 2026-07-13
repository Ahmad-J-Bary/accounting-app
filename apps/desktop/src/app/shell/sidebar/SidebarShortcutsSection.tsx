import { useSidebarLayout } from '@shared/hooks';
import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { SidebarItem } from './SidebarItem';
import { Zap } from 'lucide-react';

interface SidebarShortcutsSectionProps {
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  onClose?: () => void;
  verticalAppearance?: 'light' | 'dark';
}

export function SidebarShortcutsSection({
  collapsed, iconOnly, activeBg, hoverBg, onClose, verticalAppearance,
}: SidebarShortcutsSectionProps) {
  const { getShortcutItems } = useSidebarLayout();
  const { settings } = useNavSidebarSettings();

  const shortcutItems = getShortcutItems();
  if (shortcutItems.length === 0) return null;

  const isBgLight = verticalAppearance
    ? verticalAppearance === 'light'
    : settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const sectionHeaderClass = isBgLight ? 'text-slate-400' : 'text-slate-500';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/5';
  const bgClass = isBgLight ? 'bg-blue-50/60' : 'bg-blue-900/10';

  const showHeader = settings.navShowSectionHeaders && !collapsed && !iconOnly;

  return (
    <div className={cn("rounded-lg mb-2", bgClass, "px-1 py-1.5")}>
      {showHeader && (
        <div className="flex items-center gap-1.5 px-2 mb-1.5">
          <Zap className="w-2.5 h-2.5 text-blue-400" />
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.1em]", sectionHeaderClass)}>
            الاختصارات
          </span>
        </div>
      )}
      <ul className="space-y-0.5">
        {shortcutItems.map(item => (
          <SidebarItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            iconOnly={iconOnly}
            activeBg={activeBg}
            hoverBg={hoverBg}
            badge="shortcut"
            onClose={onClose}
            verticalAppearance={verticalAppearance}
          />
        ))}
      </ul>
      <div className={cn("mt-2 border-t opacity-30", borderClass)} />
    </div>
  );
}
