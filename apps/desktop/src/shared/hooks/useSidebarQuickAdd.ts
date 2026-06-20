import { useCallback } from 'react';
import { useSidebarLayout } from './useSidebarLayoutContext';

export function useSidebarQuickAdd() {
  const { addCustomShortcut, layout, deleteCustomShortcut } = useSidebarLayout();

  const addShortcut = useCallback((label: string, to: string, icon?: string, pinDirectly?: boolean) => {
    addCustomShortcut({ label, to, icon, pinDirectly });
  }, [addCustomShortcut]);

  const removeShortcutByPath = useCallback((to: string) => {
    const item = layout.groups.flatMap(g => g.items).find(i => i.to === to);
    if (item) {
      deleteCustomShortcut(item.id);
    }
  }, [layout.groups, deleteCustomShortcut]);

  const isAdded = useCallback((to: string) => {
    return layout.groups.flatMap(g => g.items).some(item => item.to === to);
  }, [layout.groups]);

  const isPinned = useCallback((to: string) => {
    return layout.groups.flatMap(g => g.items).some(item => item.to === to && item.pinned);
  }, [layout.groups]);

  const isShortcut = useCallback((to: string) => {
    return layout.groups.flatMap(g => g.items).some(item => item.to === to && item.isShortcut);
  }, [layout.groups]);

  return {
    addShortcut,
    removeShortcutByPath,
    isAdded,
    isPinned,
    isShortcut,
  };
}
export default useSidebarQuickAdd;
