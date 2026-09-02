import type { TabPresentationMode, WorkspaceItem } from "@shared/types/navigation";

export interface Tab {
  id: string;
  title: string;
  path: string;
  active: boolean;
  closable: boolean;
  icon?: string;
  module?: string;
  entity?: string;
  entityId?: string;
  dirty?: boolean;
  context?: Record<string, unknown>;
  permissions?: string[];
  presentationMode?: TabPresentationMode;
  restoreKey?: string;
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
  }) => void;
  updateMainTab: (tab: { title: string; path: string }) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
  markDirty: (id: string, dirty: boolean) => void;
  openDashboardTab: () => void;
}
