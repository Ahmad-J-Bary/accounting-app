// ─────────────────────────────────────────────────────────────────────────────
// sidebar-config.ts
// أنواع البيانات الخاصة بالـ Sidebar الديناميكية
// ─────────────────────────────────────────────────────────────────────────────

/** معرّف فريد لكل عنصر تنقل — لا يتغير أبداً */
export type SidebarItemId = string;
/** معرّف فريد لكل مجموعة — لا يتغير أبداً */
export type SidebarGroupId = string;

/** عنصر تنقل واحد داخل الـ Sidebar */
export interface SidebarItemConfig {
  /** معرّف فريد ثابت (يطابق الـ route بدون الـ /) */
  id: SidebarItemId;
  /** الـ route الأصلي — محمي لا يتغير */
  to: string;
  /** الاسم الافتراضي من الكود */
  defaultLabel: string;
  /** الاسم المخصص من المستخدم (اختياري) */
  customLabel?: string;
  /** اسم الأيقونة من lucide-react */
  icon: string;
  /** ظاهر في الـ Sidebar؟ */
  visible: boolean;
  /** مثبّت في قسم المثبتات؟ */
  pinned: boolean;
  /** مضاف كاختصار سريع؟ */
  isShortcut: boolean;
  /** ترتيب العنصر داخل مجموعته */
  order: number;
  /** هل هذا عنصر مخصص أضافه المستخدم؟ */
  isCustom?: boolean;
  /** هل هذا فاصل بين العناصر؟ */
  isSeparator?: boolean;
}

/** مجموعة عناصر داخل الـ Sidebar */
export interface SidebarGroupConfig {
  /** معرّف فريد ثابت للمجموعة */
  id: SidebarGroupId;
  /** العنوان الافتراضي من الكود */
  defaultTitle: string;
  /** العنوان المخصص من المستخدم */
  customTitle?: string;
  /** اسم الأيقونة من lucide-react */
  icon?: string;
  /** ظاهرة في الـ Sidebar؟ */
  visible: boolean;
  /** مطوية؟ */
  collapsed: boolean;
  /** ترتيب المجموعة */
  order: number;
  /** عناصر المجموعة */
  items: SidebarItemConfig[];
  /** هل هذه مجموعة مخصصة أنشأها المستخدم؟ */
  isCustom?: boolean;
}

/** الحالة الكاملة لتخطيط الـ Sidebar */
export interface SidebarLayoutConfig {
  /** المجموعات الديناميكية */
  groups: SidebarGroupConfig[];
  /** IDs العناصر المثبتة بالترتيب */
  pinnedItemIds: SidebarItemId[];
  /** IDs الاختصارات السريعة بالترتيب */
  shortcutIds: SidebarItemId[];
  /** رقم الإصدار للـ migration التلقائي */
  version: number;
}

/** نتيجة action على العنصر */
export type SidebarItemAction =
  | 'pin'
  | 'unpin'
  | 'hide'
  | 'show'
  | 'addShortcut'
  | 'removeShortcut'
  | 'rename';

export interface SidebarLayoutContextType {
  layout: SidebarLayoutConfig;
  allItems: SidebarItemConfig[];
  getPinnedItems: () => SidebarItemConfig[];
  getShortcutItems: () => SidebarItemConfig[];
  // ── Item actions ──────────────────────────────────────────
  toggleItemVisible: (itemId: SidebarItemId) => void;
  toggleItemPinned: (itemId: SidebarItemId) => void;
  toggleItemShortcut: (itemId: SidebarItemId) => void;
  renameItem: (itemId: SidebarItemId, label: string) => void;
  reorderItems: (groupId: SidebarGroupId, orderedIds: SidebarItemId[]) => void;
  moveItemToGroup: (itemId: SidebarItemId, targetGroupId: SidebarGroupId) => void;
  reorderPinned: (orderedIds: SidebarItemId[]) => void;
  reorderShortcuts: (orderedIds: SidebarItemId[]) => void;
  // ── Custom Item actions ───────────────────────────────────
  addCustomShortcut: (item: { label: string; to: string; icon?: string; pinDirectly?: boolean }) => void;
  deleteCustomShortcut: (itemId: SidebarItemId) => void;
  // ── Group actions ─────────────────────────────────────────
  toggleGroupVisible: (groupId: SidebarGroupId) => void;
  toggleGroupCollapsed: (groupId: SidebarGroupId) => void;
  renameGroup: (groupId: SidebarGroupId, title: string) => void;
  reorderGroups: (orderedIds: SidebarGroupId[]) => void;
  addCustomGroup: (title: string, icon?: string) => void;
  deleteCustomGroup: (groupId: SidebarGroupId) => void;
  // ── System item actions ───────────────────────────────────
  addSystemItemToGroup: (routeId: string, targetGroupId: string, customIcon?: string, customLabel?: string) => void;
  // ── Global ────────────────────────────────────────────────
  resetToDefault: () => void;
}
