export type TabPresentationMode = "default" | "browser" | "vscode";

export interface NavigationDestination {
  id: string;
  route: string;
  title: string;
  module: string;
  icon?: string;
  entity?: string;
  entityId?: string;
  closable?: boolean;
  pinned?: boolean;
  dirty?: boolean;
  context?: Record<string, unknown>;
  permissions?: string[];
  presentationMode?: TabPresentationMode;
  restoreKey?: string;
  openedAt?: number;
  order?: number;
}

export interface WorkspaceItem extends NavigationDestination {
  active: boolean;
  parentId?: string;
  windowId?: string;
}

export interface WindowWorkspaceState {
  id: string;
  label: string;
  activeItemId?: string;
  permissions?: string[];
  context?: Record<string, unknown>;
}

export interface SearchDestination {
  route: string;
  entityId?: string;
  presentationMode?: TabPresentationMode;
}

export interface GlobalSearchResult {
  id: string;
  type: "route" | "command" | "tab";
  title: string;
  subtitle?: string;
  icon?: string;
  destination?: SearchDestination;
  entityId?: string;
  permissions?: string[];
  context?: Record<string, unknown>;
  group: string;
  keywords?: string[];
}
