import { useCallback, useMemo } from 'react';
import { useSidebarLayout } from './useSidebarLayoutContext';

export function useSidebarQuickAdd() {
  const { addCustomShortcut, layout, toggleItemPinned } = useSidebarLayout();

  const allItems = useMemo(() => layout.groups.flatMap(g => g.items), [layout.groups]);

  const toggleInSidebar = useCallback((label: string, to: string, icon?: string) => {
    const existing = allItems.find(i => i.to === to);
    if (existing) {
      toggleItemPinned(existing.id);
    } else {
      addCustomShortcut({ label, to, icon });
    }
  }, [allItems, addCustomShortcut, toggleItemPinned]);

  const isInSidebar = useCallback((to: string) => {
    return allItems.some(i => i.to === to && i.pinned);
  }, [allItems]);

  return { toggleInSidebar, isInSidebar };
}
export default useSidebarQuickAdd;
