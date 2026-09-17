import React, { useState } from 'react';
import { useSidebarLayout, useNavLabels } from '@shared/hooks';
import { Button } from "@shared/ui/button";
import { ICON_MAP } from '@app/shell/sidebarConfig';
import { ALL_SYSTEM_ROUTES, findRouteById } from '@app/shell/routeRegistry';
import { IconPicker } from '@widgets/IconPicker/IconPicker';
import {
  Plus, Trash2, Edit2, Eye, EyeOff, Pin, PinOff,
  ArrowUp, ArrowDown, FolderPlus, Save, X, Settings2, FolderOpen,
  Link
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';
import { useLocalization } from "@app/providers/LocalizationProvider";

export const SidebarContentManager: React.FC = () => {
  const { t, direction } = useLocalization();
  const {
    layout,
    allItems,
    toggleItemVisible,
    toggleItemPinned,
    renameItem,
    moveItemToGroup,
    reorderItems,
    // Custom item actions
    deleteCustomShortcut,
    // Group actions
    toggleGroupVisible,
    renameGroup,
    reorderGroups,
    addCustomGroup,
    deleteCustomGroup,
    // System item actions
    addSystemItemToGroup,
    // Global
    resetToDefault,
  } = useSidebarLayout();
  const { itemLabel, groupTitle, routeLabel } = useNavLabels();

  // State management
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('FolderPlus');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupTitle, setEditGroupTitle] = useState('');

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemLabel, setEditItemLabel] = useState('');

  // Add item from routes state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemRouteId, setAddItemRouteId] = useState('');
  const [addItemGroupId, setAddItemGroupId] = useState('');
  const [addItemIcon, setAddItemIcon] = useState('Layers');
  const [addItemLabel, setAddItemLabel] = useState('');

  // Add custom group
  const handleAddGroup = () => {
    if (!newGroupTitle.trim()) return;
    addCustomGroup(newGroupTitle, newGroupIcon);
    setNewGroupTitle('');
    setNewGroupIcon('FolderPlus');
    setShowAddGroup(false);
  };

  // Rename group
  const handleStartRenameGroup = (id: string, currentTitle: string) => {
    setEditingGroupId(id);
    setEditGroupTitle(currentTitle);
  };

  const handleSaveRenameGroup = (id: string) => {
    renameGroup(id, editGroupTitle);
    setEditingGroupId(null);
  };

  // Rename item
  const handleStartRenameItem = (id: string, currentLabel: string) => {
    setEditingItemId(id);
    setEditItemLabel(currentLabel);
  };

  const handleSaveRenameItem = (id: string) => {
    renameItem(id, editItemLabel);
    setEditingItemId(null);
  };

  // Move groups up/down
  const moveGroup = (idx: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= layout.groups.length) return;
    const groupIds = layout.groups.map(g => g.id);
    const temp = groupIds[idx];
    groupIds[idx] = groupIds[nextIdx];
    groupIds[nextIdx] = temp;
    reorderGroups(groupIds);
  };

  // Move items up/down inside group
  const moveItem = (groupId: string, itemIdx: number, direction: 'up' | 'down') => {
    const group = layout.groups.find(g => g.id === groupId);
    if (!group) return;
    const nextIdx = direction === 'up' ? itemIdx - 1 : itemIdx + 1;
    if (nextIdx < 0 || nextIdx >= group.items.length) return;
    const itemIds = group.items.map(i => i.id);
    const temp = itemIds[itemIdx];
    itemIds[itemIdx] = itemIds[nextIdx];
    itemIds[nextIdx] = temp;
    reorderItems(groupId, itemIds);
  };

  return (
    <SettingsManagerLayout resetAction={resetToDefault}>
      <div className="space-y-6" dir={direction}>
        {/* Title */}
        <div className="flex flex-col gap-1 border-e-4 border-primary pe-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-foreground font-sans">{t("sidebarContent.title", { namespace: "settings",  })}</h2>
          <p className="text-xs text-muted-foreground font-sans">{t("sidebarContent.description", { namespace: "settings",  })}</p>
        </div>

        {/* ── 1. إدارة المجموعات ── */}
        <SettingsGroup title={t("sidebarContent.groupsTitle", { namespace: "settings",  })} icon={Settings2} color="text-primary">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{t("sidebarContent.groupsHint", { namespace: "settings",  })}</span>
              <Button
                size="sm"
                onClick={() => setShowAddGroup(prev => !prev)}
                className="bg-primary hover:bg-primary/80 h-9 font-bold text-xs gap-1.5 rounded-lg"
              >
                {showAddGroup ? <X className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
                {showAddGroup ? t("sidebarContent.cancel", { namespace: "settings",  }) : t("sidebarContent.addCustomGroup", { namespace: "settings",  })}
              </Button>
            </div>

            {showAddGroup && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t("sidebarContent.groupNamePlaceholder", { namespace: "settings",  })}
                    value={newGroupTitle}
                    onChange={(e) => setNewGroupTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg outline-none focus:border-primary font-bold"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                  />
                  <Button size="sm" onClick={handleAddGroup} className="bg-primary hover:bg-primary/80 text-xs font-bold rounded-lg h-8 shrink-0">
                    <Plus className="w-3.5 h-3.5 ms-1" />
                    {t("sidebarContent.add", { namespace: "settings",  })}
                  </Button>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block mb-1.5">{t("sidebarContent.chooseIcon", { namespace: "settings",  })}</span>
                  <IconPicker value={newGroupIcon} onChange={setNewGroupIcon} />
                </div>
              </div>
            )}

            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card shadow-sm">
              {layout.groups.map((group, idx) => {
                const isEditing = editingGroupId === group.id;
                const displayTitle = groupTitle(group);
                return (
                  <div key={group.id} className={cn("flex items-center justify-between p-3 transition-colors hover:bg-accent/40", !group.visible && "bg-muted/50 opacity-60")}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* أزرار الترتيب */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveGroup(idx, 'up')}
                          className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={idx === layout.groups.length - 1}
                          onClick={() => moveGroup(idx, 'down')}
                          className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* الاسم والتحرير */}
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                          <input
                            type="text"
                            value={editGroupTitle}
                            onChange={(e) => setEditGroupTitle(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-border rounded outline-none focus:border-primary font-bold"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameGroup(group.id)}
                            autoFocus
                          />
                          <button onClick={() => handleSaveRenameGroup(group.id)} className="p-1 rounded text-success hover:bg-success/10">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingGroupId(null)} className="p-1 rounded text-red-500 hover:bg-red-50">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black text-xs text-foreground truncate">{displayTitle}</span>
                          {group.isCustom && (
                            <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-full">{t("sidebarContent.customBadge", { namespace: "settings",  })}</span>
                          )}
                          <button
                            onClick={() => handleStartRenameGroup(group.id, displayTitle)}
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* الإجراءات */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-black">
                        {t("sidebarContent.itemCount", { namespace: "settings", vars: { count: group.items.length } })}
                      </span>

                      {/* إخفاء / إظهار */}
                      <button
                        onClick={() => toggleGroupVisible(group.id)}
                        className={cn("p-1.5 rounded-lg border transition-colors", group.visible ? "text-primary bg-primary/10 border-primary/20 hover:bg-primary/20" : "text-muted-foreground border-border hover:bg-accent")}
                        title={group.visible ? t("sidebarContent.hideGroup", { namespace: "settings",  }) : t("sidebarContent.showGroup", { namespace: "settings",  })}
                      >
                        {group.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* حذف لو مخصصة */}
                      {group.isCustom && (
                        <button
                          onClick={() => {
                            if (confirm(t("sidebarContent.confirmDeleteGroup", { namespace: "settings",  }))) {
                              deleteCustomGroup(group.id);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-red-100 text-red-500 bg-red-50/30 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title={t("sidebarContent.deleteGroup", { namespace: "settings",  })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SettingsGroup>

        {/* ── 2. إدارة عناصر المجموعات وتخطيطها ── */}
        <SettingsGroup title={t("sidebarContent.itemsTitle", { namespace: "settings",  })} icon={Link} color="text-primary">
          <div className="space-y-6">
            {layout.groups.map((group) => {
              const displayGroupTitle = groupTitle(group);
              return (
                <div key={group.id} className="border border-border rounded-xl overflow-hidden bg-muted/30">
                  {/* ترويسة المجموعة */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-foreground">{displayGroupTitle}</span>
                      {group.isCustom && <span className="bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-full">{t("sidebarContent.customGroupBadge", { namespace: "settings",  })}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold">{t("sidebarContent.activeItems", { namespace: "settings", vars: { count: group.items.filter(i => i.visible).length } })}</span>
                  </div>

                  {/* قائمة العناصر */}
                  {group.items.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground font-bold bg-card">
                      {t("sidebarContent.emptyGroup", { namespace: "settings",  })}
                    </div>
                  ) : (
                    <div className="divide-y divide-border bg-card">
                      {group.items.map((item, itemIdx) => {
                        const isItemEditing = editingItemId === item.id;
                        const displayItemLabel = itemLabel(item);
                        const IconComp = ICON_MAP[item.icon] ?? ICON_MAP['Settings'];

                        return (
                          <div key={item.id} className={cn("flex items-center justify-between p-2.5 hover:bg-accent/30 transition-colors", !item.visible && "bg-muted/30 opacity-60")}>
                            {/* الجانب الأيمن: الترتيب والأيقونة والتسمية */}
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {/* أزرار الترتيب */}
                              <div className="flex flex-col">
                                <button
                                  disabled={itemIdx === 0}
                                  onClick={() => moveItem(group.id, itemIdx, 'up')}
                                  className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-20"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  disabled={itemIdx === group.items.length - 1}
                                  onClick={() => moveItem(group.id, itemIdx, 'down')}
                                  className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-20"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />

                              {isItemEditing ? (
                                <div className="flex items-center gap-1 flex-1 max-w-xs">
                                  <input
                                    type="text"
                                    value={editItemLabel}
                                    onChange={(e) => setEditItemLabel(e.target.value)}
                                    className="w-full px-2 py-0.5 text-xs border border-border rounded outline-none focus:border-primary font-bold"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameItem(item.id)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveRenameItem(item.id)} className="p-0.5 rounded text-success hover:bg-success/10">
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setEditingItemId(null)} className="p-0.5 rounded text-red-500 hover:bg-red-50">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-bold text-foreground truncate">{displayItemLabel}</span>
                                  <span className="text-[9px] text-muted-foreground truncate direction-ltr">({item.to})</span>
                                  {item.isCustom && <span className="bg-success/10 text-success text-[8px] font-black px-1 rounded-full">{t("sidebarContent.customItemBadge", { namespace: "settings",  })}</span>}
                                  <button
                                    onClick={() => handleStartRenameItem(item.id, displayItemLabel)}
                                    className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* الجانب الأيسر: خيارات التثبيت والمجموعة والمسح */}
                            <div className="flex items-center gap-2.5">
                              {/* المجموعة */}
                              <select
                                value={group.id}
                                onChange={(e) => moveItemToGroup(item.id, e.target.value)}
                                className="text-[10px] bg-muted border border-border rounded px-1.5 py-1 outline-none text-muted-foreground font-bold focus:border-primary"
                              >
                                {layout.groups.map(g => (
                                  <option key={g.id} value={g.id}>{groupTitle(g)}</option>
                                ))}
                              </select>

                              {/* إظهار / إخفاء */}
                              <button
                                onClick={() => toggleItemVisible(item.id)}
                                className={cn("p-1 rounded transition-colors", item.visible ? "text-success hover:bg-success/10" : "text-muted-foreground hover:bg-accent")}
                                title={item.visible ? t("sidebarContent.hideItem", { namespace: "settings",  }) : t("sidebarContent.showItem", { namespace: "settings",  })}
                              >
                                {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* تثبيت */}
                              <button
                                onClick={() => toggleItemPinned(item.id)}
                                className={cn("p-1 rounded transition-colors", item.pinned ? "text-warning hover:bg-warning/10" : "text-muted-foreground hover:bg-accent")}
                                title={item.pinned ? t("sidebarContent.unpin", { namespace: "settings",  }) : t("sidebarContent.pin", { namespace: "settings",  })}
                              >
                                {item.pinned ? <Pin className="w-3.5 h-3.5 fill-warning" /> : <PinOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* حذف إذا كان مخصصاً */}
                              {item.isCustom && (
                                <button
                                  onClick={() => {
                                    if (confirm(t("sidebarContent.confirmDeleteItem", { namespace: "settings",  }))) {
                                      deleteCustomShortcut(item.id);
                                    }
                                  }}
                                  className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title={t("sidebarContent.deleteLink", { namespace: "settings",  })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SettingsGroup>

        {/* ── 3. إضافة عناصر جديدة من المسارات المتاحة ── */}
        <SettingsGroup title={t("sidebarContent.addRouteTitle", { namespace: "settings",  })} icon={Plus} color="text-success">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{t("sidebarContent.addRouteHint", { namespace: "settings",  })}</span>
              <Button
                size="sm"
                onClick={() => setShowAddItem(prev => !prev)}
                className="bg-success hover:bg-success/80 h-9 font-bold text-xs gap-1.5 rounded-lg"
              >
                {showAddItem ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddItem ? t("sidebarContent.cancel", { namespace: "settings",  }) : t("sidebarContent.addItem", { namespace: "settings",  })}
              </Button>
            </div>

            {showAddItem && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold">{t("sidebarContent.routeField", { namespace: "settings",  })}</span>
                    <select
                      value={addItemRouteId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setAddItemRouteId(id);
                        // تعبئة التسمية والأيقونة تلقائياً
                        if (id) {
                          const route = findRouteById(id);
                          if (route) {
                            setAddItemLabel(route.label);
                            setAddItemIcon(route.icon);
                          }
                        }
                      }}
                      className="w-full h-10 px-3 text-xs border border-border rounded-lg outline-none bg-card focus:border-success font-bold"
                    >
                      <option value="">{t("sidebarContent.selectRoute", { namespace: "settings",  })}</option>
                      {ALL_SYSTEM_ROUTES
                        .filter(item => !layout.groups.some(g => g.items.some(i => i.id === item.id && g.items.find(x => x.id === item.id)?.visible)))
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {routeLabel(item.id, item.label)}{item.groupId ? ` (${t(`nav.groups.${item.groupId}`, { namespace: "shell", fallback: item.groupLabel, })} )` : ''}
                          </option>
                        ))}
                    </select>
                    {addItemRouteId && (
                      <p className="text-[9px] text-success font-bold flex items-center gap-1">
                        <span>{t("sidebarContent.pathLabel", { namespace: "settings",  })}</span>
                        <span className="direction-ltr" dir="ltr">
                          {findRouteById(addItemRouteId)?.to}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold">{t("sidebarContent.targetGroup", { namespace: "settings",  })}</span>
                    <select
                      value={addItemGroupId}
                      onChange={(e) => setAddItemGroupId(e.target.value)}
                      className="w-full h-10 px-3 text-xs border border-border rounded-lg outline-none bg-card focus:border-success font-bold"
                    >
                      <option value="">{t("sidebarContent.selectGroup", { namespace: "settings",  })}</option>
                      {layout.groups.filter(g => g.visible).map(g => (
                        <option key={g.id} value={g.id}>{groupTitle(g)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold">{t("sidebarContent.customLabelField", { namespace: "settings",  })}</span>
                    <input
                      type="text"
                      value={addItemLabel}
                      onChange={(e) => setAddItemLabel(e.target.value)}
                      placeholder={t("sidebarContent.customLabelPlaceholder", { namespace: "settings",  })}
                      className="w-full h-10 px-3 text-xs border border-border rounded-lg outline-none focus:border-success font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold">{t("sidebarContent.iconField", { namespace: "settings",  })}</span>
                    <IconPicker value={addItemIcon} onChange={setAddItemIcon} />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    disabled={!addItemRouteId || !addItemGroupId}
                    onClick={() => {
                      if (!addItemRouteId || !addItemGroupId) return;
                      addSystemItemToGroup(addItemRouteId, addItemGroupId, addItemIcon, addItemLabel || undefined);
                      setShowAddItem(false);
                      setAddItemRouteId('');
                      setAddItemGroupId('');
                      setAddItemIcon('Layers');
                      setAddItemLabel('');
                    }}
                    className="bg-success hover:bg-success/80 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-lg h-9 gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {t("sidebarContent.addToGroup", { namespace: "settings",  })}
                  </Button>
                </div>
              </div>
            )}

            {/* لائحة بجميع مسارات النظام */}
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <div className="px-3 py-2 bg-muted border-b border-primary/20">
                <span className="text-[10px] text-muted-foreground font-bold">{t("sidebarContent.allRoutes", { namespace: "settings",  })}</span>
              </div>
              <div className="divide-y divide-border">
                {ALL_SYSTEM_ROUTES.map(item => {
                  const isInSidebar = allItems.some(i => i.id === item.id);
                  const IconComp = ICON_MAP[item.icon] ?? FolderOpen;
                  return (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComp className={cn("w-4 h-4 shrink-0", isInSidebar ? "text-muted-foreground" : "text-muted-foreground")} />
                          <span className={cn("text-xs font-bold truncate", isInSidebar ? "text-foreground" : "text-muted-foreground")}>{routeLabel(item.id, item.label)}</span>
                        <span className="text-[9px] text-muted-foreground direction-ltr" dir="ltr">{item.to}</span>
                        {item.groupId && <span className="text-[8px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{t(`nav.groups.${item.groupId}`, { namespace: "shell", fallback: item.groupLabel, })}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", isInSidebar ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                          {isInSidebar ? t("sidebarContent.added", { namespace: "settings",  }) : t("sidebarContent.notAdded", { namespace: "settings",  })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </SettingsGroup>
      </div>
    </SettingsManagerLayout>
  );
};
export default SidebarContentManager;
