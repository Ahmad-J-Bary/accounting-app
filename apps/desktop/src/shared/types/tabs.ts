import type { TabPresentationMode, WorkspaceItem } from "@shared/types/navigation";

export interface Tab {
  id: string;
  title: string;
  path: string;
  active: boolean;
  closable: boolean;
  pinned?: boolean;
  icon?: string;
  module?: string;
  entity?: string;
  entityId?: string;
  dirty?: boolean;
  context?: Record<string, unknown>;
  permissions?: string[];
  presentationMode?: TabPresentationMode;
  restoreKey?: string;
  openedAt?: number;
  order?: number;
}

export interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  workspaceItems: WorkspaceItem[];
  openTab: (tab: {
    id: string;
    title: string;
    path: string;
    closable?: boolean;
    icon?: string;
    module?: string;
    entity?: string;
    entityId?: string;
    dirty?: boolean;
    context?: Record<string, unknown>;
    permissions?: string[];
    presentationMode?: TabPresentationMode;
    pinned?: boolean;
    restoreKey?: string;
    openedAt?: number;
    order?: number;
  }) => void;
  activateTab: (id: string) => void;
  updateMainTab: (tab: { title: string; path: string }) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeAllTabs: () => void;
  reopenLastClosedTab: () => void;
  duplicateTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Omit<Tab, "id">>) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
  firstTab: () => void;
  lastTab: () => void;
  markDirty: (id: string, dirty: boolean) => void;
  openDashboardTab: () => void;
}
