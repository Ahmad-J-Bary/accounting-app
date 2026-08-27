import { useState, useEffect, useCallback } from 'react';
import type {
  SidebarLayoutConfig,
  SidebarItemId,
  SidebarGroupId,
  SidebarGroupConfig,
  SidebarItemConfig,
} from '@shared/types/sidebar-config';
import { buildDefaultLayout, NAV_GROUPS, ICON_MAP } from '@app/shell/sidebarConfig';

const STORAGE_KEY = 'erp_sidebar_layout_v3'; // ترقية: دمج isShortcut ← pinned
const CURRENT_VERSION = 3;

// ── Merge: يدمج layout المحفوظ مع NAV_GROUPS الحالية ──────────────────────
function mergeWithDefaults(saved: SidebarLayoutConfig): SidebarLayoutConfig {
  const defaultLayout = buildDefaultLayout();

  // 1. المجموعات المخصصة للمستخدم
  const customGroups = saved.groups.filter(g => g.isCustom);

  // 2. المجموعات الافتراضية
  const defaultGroupIds = new Set(defaultLayout.groups.map(g => g.id));
  const savedStandardGroups = saved.groups.filter(g => !g.isCustom && defaultGroupIds.has(g.id));

  // جميع المعرفات للعناصر المحفوظة
  const allSavedItemIds = new Set(saved.groups.flatMap(g => g.items.map(i => i.id)));

  const mergedStandardGroups: SidebarGroupConfig[] = savedStandardGroups.map(savedGroup => {
    const defaultGroup = defaultLayout.groups.find(dg => dg.id === savedGroup.id)!;
    const defaultGroupItemIds = new Set(defaultGroup.items.map(i => i.id));

    // الاحتفاظ بالعناصر المخصصة والعناصر الافتراضية التي لا تزال موجودة في الكود
    const keptItems = savedGroup.items.filter(item => item.isCustom || defaultGroupItemIds.has(item.id));

    // إضافة أي عناصر افتراضية جديدة لم تكن موجودة نهائياً في التخطيط المحفوظ
    const savedItemsInThisGroupIds = new Set(keptItems.map(i => i.id));
    const newItems = defaultGroup.items.filter(item => !allSavedItemIds.has(item.id) && !savedItemsInThisGroupIds.has(item.id));

    const mergedItems = [...keptItems, ...newItems].map((item, idx) => {
      const codeDefault = defaultGroup.items.find(di => di.id === item.id);
      return { ...item, defaultLabel: codeDefault?.defaultLabel ?? item.defaultLabel, order: idx };
    });
    return { ...savedGroup, items: mergedItems };
  });

  // المجموعات الافتراضية الجديدة تماماً التي أضيفت في الكود ولم تكن محفوظة سابقاً
  const savedStandardGroupIds = new Set(savedStandardGroups.map(g => g.id));
  const brandNewGroups = defaultLayout.groups
    .filter(dg => !savedStandardGroupIds.has(dg.id))
    .map(dg => {
      // تجنب إضافة عناصر موجودة بالفعل في مجموعات أخرى
      const items = dg.items
        .filter(item => !allSavedItemIds.has(item.id))
        .map((item, idx) => ({ ...item, order: idx }));
      return { ...dg, items };
    });

  // 3. تصفية المجموعات المخصصة من عناصر الكود التي حُذفت
  const defaultAllItemIds = new Set(defaultLayout.groups.flatMap(g => g.items.map(i => i.id)));
  const cleanedCustomGroups = customGroups.map(cg => {
    const items = cg.items
      .filter(item => item.isCustom || defaultAllItemIds.has(item.id))
      .map((item, idx) => ({ ...item, order: idx }));
    return { ...cg, items };
  });

  // دمج كل المجموعات وترتيبها
  const allGroups = [
    ...mergedStandardGroups,
    ...brandNewGroups,
    ...cleanedCustomGroups,
  ].sort((a, b) => a.order - b.order)
   .map((g, i) => ({ ...g, order: i }));

  // تنظيف المعرفات للمثبتات + ترحيل shortcutIds ← pinnedItemIds
  const allFinalItemIds = new Set(allGroups.flatMap(g => g.items.map(i => i.id)));
  const migratedPinned = [...saved.pinnedItemIds, ...((saved as SidebarLayoutConfig & { shortcutIds?: SidebarItemId[] }).shortcutIds ?? [])];
  const pinnedItemIds = [...new Set(migratedPinned)].filter(id => allFinalItemIds.has(id));

  return { groups: allGroups, pinnedItemIds, version: CURRENT_VERSION };
}

function loadFromStorage(): SidebarLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultLayout();
    const parsed = JSON.parse(raw) as SidebarLayoutConfig;
    if (parsed.version !== CURRENT_VERSION) {
      // ترقية الإصدار 1 أو 2 ← 3
      if (parsed.version === 1 || parsed.version === 2) {
        return mergeWithDefaults({ ...parsed, version: CURRENT_VERSION });
      }
      return buildDefaultLayout();
    }
    return mergeWithDefaults(parsed);
  } catch {
    return buildDefaultLayout();
  }
}

function saveToStorage(layout: SidebarLayoutConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

// ── Helper: البحث عن عنصر بـ ID عبر كل المجموعات ──────────────────────────
function findItem(layout: SidebarLayoutConfig, itemId: SidebarItemId) {
  for (const group of layout.groups) {
    const item = group.items.find(i => i.id === itemId);
    if (item) return { item, group };
  }
  return null;
}

// ── useSidebarLayout ────────────────────────────────────────────────────────
export function useSidebarLayout() {
  const [layout, setLayout] = useState<SidebarLayoutConfig>(loadFromStorage);

  // حفظ تلقائي عند كل تغيير
  useEffect(() => {
    saveToStorage(layout);
  }, [layout]);

  // ── Item actions ──────────────────────────────────────────────────────────
  const toggleItemVisible = useCallback((itemId: SidebarItemId) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g => ({
        ...g,
        items: g.items.map(i =>
          i.id === itemId ? { ...i, visible: !i.visible } : i
        ),
      })),
    }));
  }, []);

  const toggleItemPinned = useCallback((itemId: SidebarItemId) => {
    setLayout(prev => {
      const found = findItem(prev, itemId);
      if (!found) return prev;
      const nowPinned = !found.item.pinned;
      return {
        ...prev,
        groups: prev.groups.map(g => ({
          ...g,
          items: g.items.map(i =>
            i.id === itemId ? { ...i, pinned: nowPinned } : i
          ),
        })),
        pinnedItemIds: nowPinned
          ? [...prev.pinnedItemIds, itemId]
          : prev.pinnedItemIds.filter(id => id !== itemId),
      };
    });
  }, []);

  const renameItem = useCallback((itemId: SidebarItemId, label: string) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g => ({
        ...g,
        items: g.items.map(i =>
          i.id === itemId ? { ...i, customLabel: label.trim() || undefined } : i
        ),
      })),
    }));
  }, []);

  const reorderItems = useCallback((groupId: SidebarGroupId, orderedIds: SidebarItemId[]) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g => {
        if (g.id !== groupId) return g;
        const itemMap = new Map(g.items.map(i => [i.id, i]));
        const reordered = orderedIds
          .map((id, idx) => itemMap.has(id) ? { ...itemMap.get(id)!, order: idx } : null)
          .filter(Boolean) as typeof g.items;
        return { ...g, items: reordered };
      }),
    }));
  }, []);

  const moveItemToGroup = useCallback((itemId: SidebarItemId, targetGroupId: SidebarGroupId) => {
    setLayout(prev => {
      const found = findItem(prev, itemId);
      if (!found || found.group.id === targetGroupId) return prev;
      const movedItem = { ...found.item };
      return {
        ...prev,
        groups: prev.groups.map(g => {
          if (g.id === found.group.id) {
            return { ...g, items: g.items.filter(i => i.id !== itemId) };
          }
          if (g.id === targetGroupId) {
            return { ...g, items: [...g.items, { ...movedItem, order: g.items.length }] };
          }
          return g;
        }),
      };
    });
  }, []);

  const reorderPinned = useCallback((orderedIds: SidebarItemId[]) => {
    setLayout(prev => ({ ...prev, pinnedItemIds: orderedIds }));
  }, []);

  // ── Custom Item actions ───────────────────────────────────────────────────
  const addCustomShortcut = useCallback((item: { label: string; to: string; icon?: string }) => {
    setLayout(prev => {
      const allItemsFlat = prev.groups.flatMap(g => g.items);
      const existing = allItemsFlat.find(i => i.to === item.to);

      if (existing) {
        return {
          ...prev,
          groups: prev.groups.map(g => ({
            ...g,
            items: g.items.map(i =>
              i.id === existing.id ? { ...i, visible: true, pinned: true } : i
            )
          })),
          pinnedItemIds: prev.pinnedItemIds.includes(existing.id)
            ? prev.pinnedItemIds
            : [...prev.pinnedItemIds, existing.id],
        };
      }

      const newItemId = `custom_item_${Date.now()}`;
      const newCustomItem: SidebarItemConfig = {
        id: newItemId,
        to: item.to,
        defaultLabel: item.label,
        icon: item.icon || 'Layers',
        visible: true,
        pinned: true,
        isCustom: true,
        order: 0,
      };

      const hasCustomGroup = prev.groups.some(g => g.id === 'custom_group_links');
      let updatedGroups = [...prev.groups];

      if (!hasCustomGroup) {
        updatedGroups.push({
          id: 'custom_group_links',
          defaultTitle: 'روابط سريعة',
          icon: 'Link',
          visible: true,
          collapsed: false,
          items: [newCustomItem],
          isCustom: true,
          order: prev.groups.length,
        });
      } else {
        updatedGroups = updatedGroups.map(g =>
          g.id === 'custom_group_links'
            ? { ...g, items: [...g.items, { ...newCustomItem, order: g.items.length }] }
            : g
        );
      }

      return {
        ...prev,
        groups: updatedGroups,
        pinnedItemIds: [...prev.pinnedItemIds, newItemId],
      };
    });
  }, []);

  const deleteCustomShortcut = useCallback((itemId: SidebarItemId) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g => ({
        ...g,
        items: g.items.filter(i => i.id !== itemId).map((item, idx) => ({ ...item, order: idx })),
      })),
      pinnedItemIds: prev.pinnedItemIds.filter(id => id !== itemId),
    }));
  }, []);

  // ── Group actions ─────────────────────────────────────────────────────────
  const toggleGroupVisible = useCallback((groupId: SidebarGroupId) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, visible: !g.visible } : g
      ),
    }));
  }, []);

  const toggleGroupCollapsed = useCallback((groupId: SidebarGroupId) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      ),
    }));
  }, []);

  const renameGroup = useCallback((groupId: SidebarGroupId, title: string) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, customTitle: title.trim() || undefined } : g
      ),
    }));
  }, []);

  const reorderGroups = useCallback((orderedIds: SidebarGroupId[]) => {
    setLayout(prev => {
      const groupMap = new Map(prev.groups.map(g => [g.id, g]));
      const reordered = orderedIds
        .map((id, idx) => groupMap.has(id) ? { ...groupMap.get(id)!, order: idx } : null)
        .filter(Boolean) as SidebarGroupConfig[];
      return { ...prev, groups: reordered };
    });
  }, []);

  const addCustomGroup = useCallback((title: string, icon?: string) => {
    setLayout(prev => {
      const newGroupId = `custom_group_${Date.now()}`;
      const newGroup: SidebarGroupConfig = {
        id: newGroupId,
        defaultTitle: title.trim() || 'مجموعة مخصصة جديدة',
        customTitle: undefined,
        icon: icon || 'FolderPlus',
        visible: true,
        collapsed: false,
        items: [],
        isCustom: true,
        order: prev.groups.length,
      };
      return {
        ...prev,
        groups: [...prev.groups, newGroup],
      };
    });
  }, []);

  const deleteCustomGroup = useCallback((groupId: SidebarGroupId) => {
    setLayout(prev => {
      const targetGroup = prev.groups.find(g => g.id === groupId);
      if (!targetGroup) return prev;

      // تصفية المجموعة المحذوفة
      const remainingGroups = prev.groups.filter(g => g.id !== groupId);

      // إعادة توزيع العناصر في المجموعة المحذوفة
      const itemsToRedistribute = targetGroup.items;
      let updatedGroups = [...remainingGroups];

      itemsToRedistribute.forEach(item => {
        if (item.isCustom) {
          // إذا كان العنصر مخصصاً، نقوم بنقله إلى مجموعة الروابط السريعة الافتراضية
          let linksGroup = updatedGroups.find(g => g.id === 'custom_group_links');
          if (!linksGroup) {
            linksGroup = {
              id: 'custom_group_links',
              defaultTitle: 'روابط سريعة',
              customTitle: undefined,
              visible: true,
              collapsed: false,
              items: [],
              isCustom: true,
              order: updatedGroups.length,
            };
            updatedGroups.push(linksGroup);
          }
          linksGroup.items.push({ ...item, order: linksGroup.items.length });
        } else {
          // إذا كان عنصراً افتراضياً، نعيده لمجموعته الأصلية بحسب NAV_GROUPS
          const defaultGroupInfo = NAV_GROUPS.find(g => g.items.some(i => i.id === item.id));
          const targetGroupToReturn = defaultGroupInfo ? defaultGroupInfo.id : 'main';

          updatedGroups = updatedGroups.map(g => {
            if (g.id === targetGroupToReturn) {
              return {
                ...g,
                items: [...g.items, { ...item, order: g.items.length }]
              };
            }
            return g;
          });
        }
      });

      return {
        ...prev,
        groups: updatedGroups.map((g, idx) => ({ ...g, order: idx })),
      };
    });
  }, []);

  // ── System item actions ─────────────────────────────────────────────────
  const addSystemItemToGroup = useCallback((routeId: string, targetGroupId: string, customIcon?: string, customLabel?: string) => {
    setLayout(prev => {
      // البحث عن المسار في NAV_GROUPS
      const navGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === routeId));
      if (!navGroup) return prev;
      const navItem = navGroup.items.find(i => i.id === routeId)!;

      // هل العنصر موجود مسبقاً في أي مجموعة؟
      const existingGroup = prev.groups.find(g => g.items.some(i => i.id === routeId));
      if (existingGroup) {
        // مجرد تفعيل الظهور
        return {
          ...prev,
          groups: prev.groups.map(g => ({
            ...g,
            items: g.items.map(i =>
              i.id === routeId ? { ...i, visible: true } : i
            ),
          })),
        };
      }

      // إنشاء عنصر جديد بناءً على مسار النظام
      const newItem: SidebarItemConfig = {
        id: routeId,
        to: navItem.to,
        defaultLabel: customLabel || navItem.label,
        icon: customIcon || Object.keys(ICON_MAP).find(k => ICON_MAP[k] === navItem.icon) || 'Layers',
        visible: true,
        pinned: false,
        order: 0,
      };

      return {
        ...prev,
        groups: prev.groups.map(g =>
          g.id === targetGroupId
            ? { ...g, items: [...g.items, { ...newItem, order: g.items.length }] }
            : g
        ),
      };
    });
  }, []);

  // ── Global ────────────────────────────────────────────────────────────────
  const resetToDefault = useCallback(() => {
    const def = buildDefaultLayout();
    setLayout(def);
  }, []);

  // مسطّح لكل العناصر
  const allItems = layout.groups.flatMap(g => g.items);

  // مساعدات البحث
  const getPinnedItems = useCallback(() =>
    layout.pinnedItemIds
      .map(id => allItems.find(i => i.id === id))
      .filter(Boolean) as SidebarItemConfig[], [layout.pinnedItemIds, allItems]);

  return {
    layout,
    allItems,
    getPinnedItems,
    // Item actions
    toggleItemVisible,
    toggleItemPinned,
    renameItem,
    reorderItems,
    moveItemToGroup,
    reorderPinned,
    // Custom Item actions
    addCustomShortcut,
    deleteCustomShortcut,
    // Group actions
    toggleGroupVisible,
    toggleGroupCollapsed,
    renameGroup,
    reorderGroups,
    addCustomGroup,
    deleteCustomGroup,
    // Global
    resetToDefault,
    // System item actions
    addSystemItemToGroup,
    // NAV_GROUPS للاستخدام في TopNav الثابت
    NAV_GROUPS,
  };
}
