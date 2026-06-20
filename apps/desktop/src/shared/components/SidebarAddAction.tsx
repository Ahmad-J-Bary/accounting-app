import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSidebarQuickAdd } from '@shared/hooks/useSidebarQuickAdd';
import { Pin, Zap, Plus, Check, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';

interface SidebarAddActionProps {
  /** العنوان الافتراضي للاختصار */
  label: string;
  /** المسار المرتبط (افتراضياً المسار الحالي) */
  to?: string;
  /** الأيقونة المفضلة للاختصار */
  icon?: string;
  /** فئة تنسيق إضافية للزر */
  className?: string;
}

export function SidebarAddAction({ label, to, icon = 'Layers', className }: SidebarAddActionProps) {
  const location = useLocation();
  const targetPath = to || location.pathname + location.search;

  const { addShortcut, removeShortcutByPath, isAdded, isPinned, isShortcut } = useSidebarQuickAdd();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const added = isAdded(targetPath);
  const pinned = isPinned(targetPath);
  const shortcut = isShortcut(targetPath);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTogglePin = () => {
    addShortcut(label, targetPath, icon, true);
    setIsOpen(false);
  };

  const handleToggleShortcut = () => {
    addShortcut(label, targetPath, icon, false);
    setIsOpen(false);
  };

  const handleRemove = () => {
    removeShortcutByPath(targetPath);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-right" ref={dropdownRef}>
      <Button
        variant={added ? "secondary" : "outline"}
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "gap-1.5 rounded-lg text-xs font-bold transition-all duration-200",
          added
            ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100/70"
            : "text-slate-600 hover:bg-slate-50 border-slate-200",
          className
        )}
      >
        {added ? (
          <>
            <Check className="w-3.5 h-3.5 text-blue-600" />
            <span>مضاف للشريط</span>
          </>
        ) : (
          <>
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>إضافة للشريط</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </Button>

      {isOpen && (
        <div className={cn(
          "absolute left-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-150 shadow-lg",
          "py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        )}>
          <div className="px-3 py-1 border-b border-slate-100 mb-1">
            <span className="text-[10px] text-slate-400 font-black">خيارات التثبيت</span>
          </div>

          {/* تثبيت في الأعلى */}
          <button
            onClick={handleTogglePin}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-right text-xs font-bold transition-colors hover:bg-slate-50",
              pinned ? "text-amber-600 bg-amber-50/40 hover:bg-amber-50" : "text-slate-700"
            )}
          >
            <Pin className={cn("w-3.5 h-3.5", pinned ? "fill-amber-500 text-amber-500" : "text-slate-400")} />
            <span className="flex-1">تثبيت في الأعلى</span>
            {pinned && <Check className="w-3.5 h-3.5 text-amber-600" />}
          </button>

          {/* إضافة كاختصار سريع */}
          <button
            onClick={handleToggleShortcut}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-right text-xs font-bold transition-colors hover:bg-slate-50",
              shortcut ? "text-blue-600 bg-blue-50/30 hover:bg-blue-50" : "text-slate-700"
            )}
          >
            <Zap className={cn("w-3.5 h-3.5", shortcut ? "fill-blue-500 text-blue-500" : "text-slate-400")} />
            <span className="flex-1">إضافة كاختصار سريع</span>
            {shortcut && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          {added && (
            <>
              <div className="border-t border-slate-100 my-1" />
              {/* إزالة من الشريط */}
              <button
                onClick={handleRemove}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-right text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>إزالة من الشريط</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export default SidebarAddAction;
