import React from 'react';
import { useSidebarLayout } from '@shared/hooks';
import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { SidebarItem } from './SidebarItem';
import { Pin } from 'lucide-react';

interface SidebarPinnedSectionProps {
  collapsed: boolean;
  iconOnly: boolean;
  activeBg: string;
  hoverBg: string;
  onClose?: () => void;
}

export function SidebarPinnedSection({
  collapsed, iconOnly, activeBg, hoverBg, onClose,
}: SidebarPinnedSectionProps) {
  const { getPinnedItems } = useSidebarLayout();
  const { settings } = useNavSidebarSettings();

  const pinnedItems = getPinnedItems();
  if (pinnedItems.length === 0) return null;

  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const sectionHeaderClass = isBgLight ? 'text-slate-400' : 'text-slate-500';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/5';
  const bgClass = isBgLight ? 'bg-slate-100/60' : 'bg-white/5';

  const showHeader = settings.navShowSectionHeaders && !collapsed && !iconOnly;

  return (
    <div className={cn("rounded-lg mb-2", bgClass, "px-1 py-1.5")}>
      {showHeader && (
        <div className="flex items-center gap-1.5 px-2 mb-1.5">
          <Pin className={cn("w-2.5 h-2.5", "text-amber-400")} />
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.1em]", sectionHeaderClass)}>
            المثبتات
          </span>
        </div>
      )}
      <ul className="space-y-0.5">
        {pinnedItems.map(item => (
          <SidebarItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            iconOnly={iconOnly}
            activeBg={activeBg}
            hoverBg={hoverBg}
            badge="pinned"
            onClose={onClose}
          />
        ))}
      </ul>
      <div className={cn("mt-2 border-t opacity-30", borderClass)} />
    </div>
  );
}
