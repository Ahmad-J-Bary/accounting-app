import { useState } from 'react';
import { useSidebarLayout } from '@shared/hooks';
import { useNavSidebarSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { ICON_MAP } from '@app/shell/sidebarConfig';
import { Eye, EyeOff, Pin, PinOff, Zap, ZapOff, RotateCcw, X, Settings2 } from 'lucide-react';
import { Button } from '@shared/ui/button';

interface SidebarCustomizeDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarCustomizeDrawer({ open, onClose }: SidebarCustomizeDrawerProps) {
  const {
    layout,
    toggleItemVisible,
    toggleItemPinned,
    toggleItemShortcut,
    toggleGroupVisible,
    resetToDefault,
  } = useSidebarLayout();
  const { settings } = useNavSidebarSettings();

  const [tab, setTab] = useState<'items' | 'groups'>('items');

  const isBgLight = settings.navBackground === 'bg-white' || settings.navBackground === 'bg-slate-50';
  const drawerBg = isBgLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700';
  const headerBg = isBgLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-700';
  const textClass = isBgLight ? 'text-slate-800' : 'text-white';
  const subtextClass = isBgLight ? 'text-slate-500' : 'text-slate-400';
  const itemHover = isBgLight ? 'hover:bg-slate-50' : 'hover:bg-white/5';
  const itemBorder = isBgLight ? 'border-slate-100' : 'border-white/5';

  if (!open) return null;

  const allItems = layout.groups.flatMap(g => g.items);

  return (
    <div className={cn(
      "absolute inset-y-0 right-0 z-50 flex flex-col border-l shadow-2xl transition-all duration-300",
      "w-64",
      drawerBg,
    )}>
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 border-b shrink-0", headerBg)}>
        <div className="flex items-center gap-2">
          <Settings2 className={cn("w-4 h-4", subtextClass)} />
          <span className={cn("text-sm font-bold", textClass)}>تخصيص الشريط</span>
        </div>
        <button
          onClick={onClose}
          className={cn("p-1 rounded transition-colors", subtextClass, "hover:text-red-400")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className={cn("flex border-b shrink-0", headerBg)}>
        {(['items', 'groups'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-xs font-bold transition-colors",
              tab === t
                ? "border-b-2 border-blue-500 text-blue-500"
                : `${subtextClass} hover:${textClass}`
            )}
          >
            {t === 'items' ? 'العناصر' : 'المجموعات'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'items' ? (
          <div className="p-2 space-y-1">
            <p className={cn("text-[10px] px-2 py-1", subtextClass)}>
              تحكم في ظهور العناصر وتثبيتها واختصاراتها
            </p>
            {allItems.map(item => {
              const IconComp = ICON_MAP[item.icon] ?? ICON_MAP['Settings'];
              const displayLabel = item.customLabel ?? item.defaultLabel;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors",
                    itemHover, itemBorder,
                    !item.visible && "opacity-50"
                  )}
                >
                  <IconComp className={cn("w-3.5 h-3.5 shrink-0", subtextClass)} />
                  <span className={cn("text-xs flex-1 truncate", textClass)}>{displayLabel}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => toggleItemVisible(item.id)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        item.visible ? "text-emerald-500" : subtextClass
                      )}
                      title={item.visible ? "إخفاء" : "إظهار"}
                    >
                      {item.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => toggleItemPinned(item.id)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        item.pinned ? "text-amber-400" : subtextClass
                      )}
                      title={item.pinned ? "إلغاء التثبيت" : "تثبيت"}
                    >
                      {item.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => toggleItemShortcut(item.id)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        item.isShortcut ? "text-blue-400" : subtextClass
                      )}
                      title={item.isShortcut ? "إزالة الاختصار" : "اختصار"}
                    >
                      {item.isShortcut ? <ZapOff className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <p className={cn("text-[10px] px-2 py-1", subtextClass)}>
              تحكم في ظهور المجموعات وطيّها
            </p>
            {layout.groups.map(group => {
              const displayTitle = group.customTitle ?? group.defaultTitle;
              return (
                <div
                  key={group.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors",
                    itemHover, itemBorder,
                    !group.visible && "opacity-50"
                  )}
                >
                  <span className={cn("text-xs flex-1 truncate font-medium", textClass)}>
                    {displayTitle}
                  </span>
                  <span className={cn("text-[10px]", subtextClass)}>
                    {group.items.filter(i => i.visible).length}/{group.items.length}
                  </span>
                  <button
                    onClick={() => toggleGroupVisible(group.id)}
                    className={cn(
                      "p-1 rounded transition-colors",
                      group.visible ? "text-emerald-500" : subtextClass
                    )}
                    title={group.visible ? "إخفاء المجموعة" : "إظهار المجموعة"}
                  >
                    {group.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn("p-3 border-t shrink-0", headerBg)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { resetToDefault(); onClose(); }}
          className="w-full text-xs gap-1.5 rounded-lg"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          استعادة الإعدادات الافتراضية
        </Button>
      </div>
    </div>
  );
}
