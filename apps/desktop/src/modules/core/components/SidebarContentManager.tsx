import React, { useState } from 'react';
import { useSidebarLayout } from '@shared/hooks';
import { Label } from "@shared/ui/label";
import { Switch } from "@shared/ui/switch";
import { Button } from "@shared/ui/button";
import { ICON_MAP } from '@app/shell/sidebarConfig';
import { ALL_SYSTEM_ROUTES, findRouteById } from '@app/shell/routeRegistry';
import { IconPicker } from '@widgets/IconPicker/IconPicker';
import {
  Plus, Trash2, Edit2, Eye, EyeOff, Pin, PinOff, Zap, ZapOff,
  ArrowUp, ArrowDown, FolderPlus, Save, X, Settings2, FolderOpen,
  Link
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';

export const SidebarContentManager: React.FC = () => {
  const {
    layout,
    allItems,
    toggleItemVisible,
    toggleItemPinned,
    toggleItemShortcut,
    renameItem,
    moveItemToGroup,
    reorderItems,
    // Custom item actions
    addCustomShortcut,
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
      <div className="space-y-6" dir="rtl">
        {/* Title */}
        <div className="flex flex-col gap-1 border-r-4 border-blue-600 pr-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-slate-800 font-sans">تخصيص محتوى وترتيب القائمة</h2>
          <p className="text-xs text-slate-500 font-sans">إدارة المجموعات، ترتيب العناصر، تفعيل الاختصارات السريعة، وتثبيت التفضيلات في الشريط الجانبي</p>
        </div>

        {/* ── 1. إدارة المجموعات ── */}
        <SettingsGroup title="إدارة المجموعات والأقسام" icon={Settings2} color="text-blue-600">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">قم بترتيب المجموعات أو إضافتها أو إخفائها بالكامل</span>
              <Button
                size="sm"
                onClick={() => setShowAddGroup(prev => !prev)}
                className="bg-blue-600 hover:bg-blue-700 h-9 font-bold text-xs gap-1.5 rounded-lg"
              >
                {showAddGroup ? <X className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
                {showAddGroup ? 'إلغاء' : 'إضافة مجموعة مخصصة'}
              </Button>
            </div>

            {showAddGroup && (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="اسم المجموعة الجديدة..."
                    value={newGroupTitle}
                    onChange={(e) => setNewGroupTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                  />
                  <Button size="sm" onClick={handleAddGroup} className="bg-blue-600 hover:bg-blue-700 text-xs font-bold rounded-lg h-8 shrink-0">
                    <Plus className="w-3.5 h-3.5 ml-1" />
                    إضافة
                  </Button>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-1.5">اختيار أيقونة للمجموعة:</span>
                  <IconPicker value={newGroupIcon} onChange={setNewGroupIcon} />
                </div>
              </div>
            )}

            <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white shadow-sm">
              {layout.groups.map((group, idx) => {
                const isEditing = editingGroupId === group.id;
                const displayTitle = group.customTitle ?? group.defaultTitle;
                return (
                  <div key={group.id} className={cn("flex items-center justify-between p-3 transition-colors hover:bg-slate-50/40", !group.visible && "bg-slate-50/50 opacity-60")}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* أزرار الترتيب */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveGroup(idx, 'up')}
                          className="p-0.5 rounded hover:bg-slate-150 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={idx === layout.groups.length - 1}
                          onClick={() => moveGroup(idx, 'down')}
                          className="p-0.5 rounded hover:bg-slate-150 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
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
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:border-blue-500 font-bold"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameGroup(group.id)}
                            autoFocus
                          />
                          <button onClick={() => handleSaveRenameGroup(group.id)} className="p-1 rounded text-emerald-600 hover:bg-emerald-50">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingGroupId(null)} className="p-1 rounded text-red-500 hover:bg-red-50">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black text-xs text-slate-800 truncate">{displayTitle}</span>
                          {group.isCustom && (
                            <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded-full">مخصصة</span>
                          )}
                          <button
                            onClick={() => handleStartRenameGroup(group.id, displayTitle)}
                            className="p-1 rounded text-slate-400 hover:text-blue-500 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* الإجراءات */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-black">
                        {group.items.length} عناصر
                      </span>

                      {/* إخفاء / إظهار */}
                      <button
                        onClick={() => toggleGroupVisible(group.id)}
                        className={cn("p-1.5 rounded-lg border transition-colors", group.visible ? "text-blue-600 bg-blue-50/50 border-blue-100 hover:bg-blue-100/60" : "text-slate-400 border-slate-200 hover:bg-slate-100")}
                        title={group.visible ? "إخفاء المجموعة" : "إظهار المجموعة"}
                      >
                        {group.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* حذف لو مخصصة */}
                      {group.isCustom && (
                        <button
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذه المجموعة؟ سيتم إرجاع العناصر الافتراضية بداخلها إلى مكانها الأساسي.')) {
                              deleteCustomGroup(group.id);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-red-100 text-red-500 bg-red-50/30 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="حذف المجموعة"
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
        <SettingsGroup title="توزيع وعناصر القائمة التفصيلية" icon={Link} color="text-indigo-600">
          <div className="space-y-6">
            {layout.groups.map((group) => {
              const groupTitle = group.customTitle ?? group.defaultTitle;
              return (
                <div key={group.id} className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/30">
                  {/* ترويسة المجموعة */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-150">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800">{groupTitle}</span>
                      {group.isCustom && <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded-full">مجموعة مخصصة</span>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">العناصر النشطة: {group.items.filter(i => i.visible).length}</span>
                  </div>

                  {/* قائمة العناصر */}
                  {group.items.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold bg-white">
                      لا توجد عناصر بداخل هذه المجموعة حالياً. اسحب وانقل عناصر إليها لتنظيمها.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 bg-white">
                      {group.items.map((item, itemIdx) => {
                        const isItemEditing = editingItemId === item.id;
                        const itemLabel = item.customLabel ?? item.defaultLabel;
                        const IconComp = ICON_MAP[item.icon] ?? ICON_MAP['Settings'];

                        return (
                          <div key={item.id} className={cn("flex items-center justify-between p-2.5 hover:bg-slate-50/30 transition-colors", !item.visible && "bg-slate-50/30 opacity-60")}>
                            {/* الجانب الأيمن: الترتيب والأيقونة والتسمية */}
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {/* أزرار الترتيب */}
                              <div className="flex flex-col">
                                <button
                                  disabled={itemIdx === 0}
                                  onClick={() => moveItem(group.id, itemIdx, 'up')}
                                  className="p-0.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-20"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  disabled={itemIdx === group.items.length - 1}
                                  onClick={() => moveItem(group.id, itemIdx, 'down')}
                                  className="p-0.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-20"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              <IconComp className="w-4 h-4 text-slate-400 shrink-0" />

                              {isItemEditing ? (
                                <div className="flex items-center gap-1 flex-1 max-w-xs">
                                  <input
                                    type="text"
                                    value={editItemLabel}
                                    onChange={(e) => setEditItemLabel(e.target.value)}
                                    className="w-full px-2 py-0.5 text-xs border border-slate-350 rounded outline-none focus:border-blue-500 font-bold"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameItem(item.id)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveRenameItem(item.id)} className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50">
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setEditingItemId(null)} className="p-0.5 rounded text-red-500 hover:bg-red-50">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-bold text-slate-700 truncate">{itemLabel}</span>
                                  <span className="text-[9px] text-slate-400 truncate direction-ltr">({item.to})</span>
                                  {item.isCustom && <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1 rounded-full">مخصص</span>}
                                  <button
                                    onClick={() => handleStartRenameItem(item.id, itemLabel)}
                                    className="p-0.5 rounded text-slate-400 hover:text-blue-500 transition-colors"
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
                                className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none text-slate-600 font-bold focus:border-blue-500"
                              >
                                {layout.groups.map(g => (
                                  <option key={g.id} value={g.id}>{g.customTitle ?? g.defaultTitle}</option>
                                ))}
                              </select>

                              {/* إظهار / إخفاء */}
                              <button
                                onClick={() => toggleItemVisible(item.id)}
                                className={cn("p-1 rounded transition-colors", item.visible ? "text-emerald-500 hover:bg-emerald-50/50" : "text-slate-350 hover:bg-slate-50")}
                                title={item.visible ? "إخفاء" : "إظهار"}
                              >
                                {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* تثبيت */}
                              <button
                                onClick={() => toggleItemPinned(item.id)}
                                className={cn("p-1 rounded transition-colors", item.pinned ? "text-amber-500 hover:bg-amber-50/50" : "text-slate-350 hover:bg-slate-50")}
                                title={item.pinned ? "إلغاء التثبيت في الأعلى" : "تثبيت في الأعلى"}
                              >
                                {item.pinned ? <Pin className="w-3.5 h-3.5 fill-amber-500" /> : <PinOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* اختصار سريع */}
                              <button
                                onClick={() => toggleItemShortcut(item.id)}
                                className={cn("p-1 rounded transition-colors", item.isShortcut ? "text-blue-500 hover:bg-blue-50/50" : "text-slate-350 hover:bg-slate-50")}
                                title={item.isShortcut ? "إلغاء الاختصار السريع" : "إضافة للاختصارات السريعة"}
                              >
                                {item.isShortcut ? <Zap className="w-3.5 h-3.5 fill-blue-500" /> : <ZapOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* حذف إذا كان مخصصاً */}
                              {item.isCustom && (
                                <button
                                  onClick={() => {
                                    if (confirm('هل أنت متأكد من حذف هذا الاختصار بالكامل؟')) {
                                      deleteCustomShortcut(item.id);
                                    }
                                  }}
                                  className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="حذف الرابط"
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
        <SettingsGroup title="إضافة عنصر تنقل من مسارات النظام" icon={Plus} color="text-emerald-600">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">إضافة أي مسار موجود في النظام إلى إحدى المجموعات بسهولة</span>
              <Button
                size="sm"
                onClick={() => setShowAddItem(prev => !prev)}
                className="bg-emerald-600 hover:bg-emerald-700 h-9 font-bold text-xs gap-1.5 rounded-lg"
              >
                {showAddItem ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddItem ? 'إلغاء' : 'إضافة عنصر'}
              </Button>
            </div>

            {showAddItem && (
              <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-600 font-bold">المسار</span>
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
                      className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none bg-white focus:border-emerald-500 font-bold"
                    >
                      <option value="">-- اختر المسار --</option>
                      {ALL_SYSTEM_ROUTES
                        .filter(item => !layout.groups.some(g => g.items.some(i => i.id === item.id && g.items.find(x => x.id === item.id)?.visible)))
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {item.label}{item.groupLabel ? ` (${item.groupLabel})` : ''}
                          </option>
                        ))}
                    </select>
                    {addItemRouteId && (
                      <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                        <span>المسار:</span>
                        <span className="direction-ltr" dir="ltr">
                          {findRouteById(addItemRouteId)?.to}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-600 font-bold">المجموعة المستهدفة</span>
                    <select
                      value={addItemGroupId}
                      onChange={(e) => setAddItemGroupId(e.target.value)}
                      className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none bg-white focus:border-emerald-500 font-bold"
                    >
                      <option value="">-- اختر المجموعة --</option>
                      {layout.groups.filter(g => g.visible).map(g => (
                        <option key={g.id} value={g.id}>{g.customTitle ?? g.defaultTitle}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-600 font-bold">التسمية (اختياري)</span>
                    <input
                      type="text"
                      value={addItemLabel}
                      onChange={(e) => setAddItemLabel(e.target.value)}
                      placeholder="تسمية مخصصة (اختياري)"
                      className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-600 font-bold">الأيقونة (اختياري)</span>
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
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-lg h-9 gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة إلى المجموعة
                  </Button>
                </div>
              </div>
            )}

            {/* لائحة بجميع مسارات النظام */}
            <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-[10px] text-slate-500 font-bold">جميع مسارات النظام المتاحة</span>
              </div>
              <div className="divide-y divide-slate-100">
                {ALL_SYSTEM_ROUTES.map(item => {
                  const isInSidebar = allItems.some(i => i.id === item.id);
                  const IconComp = ICON_MAP[item.icon] ?? FolderOpen;
                  return (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComp className={cn("w-4 h-4 shrink-0", isInSidebar ? "text-slate-500" : "text-slate-400")} />
                        <span className={cn("text-xs font-bold truncate", isInSidebar ? "text-slate-800" : "text-slate-500")}>{item.label}</span>
                        <span className="text-[9px] text-slate-400 direction-ltr" dir="ltr">{item.to}</span>
                        {item.groupLabel && <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{item.groupLabel}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", isInSidebar ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                          {isInSidebar ? 'مضاف' : 'غير مضاف'}
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
