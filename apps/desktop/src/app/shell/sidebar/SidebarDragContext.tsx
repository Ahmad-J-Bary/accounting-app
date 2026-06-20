import React, { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useSidebarLayout } from '@shared/hooks';
import type { SidebarItemConfig } from '@shared/types/sidebar-config';
import { ICON_MAP } from '@app/shell/sidebarConfig';
import { cn } from '@shared/lib/utils';

interface SidebarDragContextProps {
  children: React.ReactNode;
}

export function SidebarDragContext({ children }: SidebarDragContextProps) {
  const {
    layout,
    reorderItems,
    reorderGroups,
    reorderPinned,
    reorderShortcuts,
    moveItemToGroup,
  } = useSidebarLayout();

  const [activeItem, setActiveItem] = useState<SidebarItemConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // ابحث عن العنصر في كل المجموعات
    for (const group of layout.groups) {
      const found = group.items.find(i => i.id === active.id);
      if (found) { setActiveItem(found); return; }
    }
    const pinned = layout.pinnedItemIds
      .map(id => layout.groups.flatMap(g => g.items).find(i => i.id === id))
      .filter(Boolean)[0];
    if (pinned) setActiveItem(pinned as SidebarItemConfig);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // ─── حالة 1: إعادة ترتيب المجموعات ────────────────────────
    const groupIds = layout.groups.map(g => g.id);
    if (groupIds.includes(activeId) && groupIds.includes(overId)) {
      const oldIdx = groupIds.indexOf(activeId);
      const newIdx = groupIds.indexOf(overId);
      reorderGroups(arrayMove(groupIds, oldIdx, newIdx));
      return;
    }

    // ─── حالة 2: إعادة ترتيب في المثبتات ──────────────────────
    if (layout.pinnedItemIds.includes(activeId) && layout.pinnedItemIds.includes(overId)) {
      const oldIdx = layout.pinnedItemIds.indexOf(activeId);
      const newIdx = layout.pinnedItemIds.indexOf(overId);
      reorderPinned(arrayMove(layout.pinnedItemIds, oldIdx, newIdx));
      return;
    }

    // ─── حالة 3: إعادة ترتيب في الاختصارات ────────────────────
    if (layout.shortcutIds.includes(activeId) && layout.shortcutIds.includes(overId)) {
      const oldIdx = layout.shortcutIds.indexOf(activeId);
      const newIdx = layout.shortcutIds.indexOf(overId);
      reorderShortcuts(arrayMove(layout.shortcutIds, oldIdx, newIdx));
      return;
    }

    // ─── حالة 4: إعادة ترتيب داخل مجموعة / نقل بين مجموعات ──
    let activeGroupId: string | null = null;
    let overGroupId: string | null = null;

    for (const group of layout.groups) {
      const itemIds = group.items.map(i => i.id);
      if (itemIds.includes(activeId)) activeGroupId = group.id;
      if (itemIds.includes(overId)) overGroupId = group.id;
    }

    if (!activeGroupId) return;

    if (activeGroupId === overGroupId && overGroupId) {
      // نفس المجموعة → reorder
      const group = layout.groups.find(g => g.id === activeGroupId)!;
      const ids = group.items.map(i => i.id);
      const oldIdx = ids.indexOf(activeId);
      const newIdx = ids.indexOf(overId);
      reorderItems(activeGroupId, arrayMove(ids, oldIdx, newIdx));
    } else if (overGroupId && activeGroupId !== overGroupId) {
      // مجموعة مختلفة → move
      moveItemToGroup(activeId, overGroupId);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      {/* مؤشر العنصر المسحوب */}
      <DragOverlay>
        {activeItem && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
            "bg-blue-600 text-white shadow-xl opacity-90 pointer-events-none"
          )}>
            {(() => {
              const Icon = ICON_MAP[activeItem.icon] ?? ICON_MAP['Settings'];
              return <Icon className="w-4 h-4 shrink-0" />;
            })()}
            <span>{activeItem.customLabel ?? activeItem.defaultLabel}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
