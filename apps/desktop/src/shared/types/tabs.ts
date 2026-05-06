export interface Tab {
  id: string;
  title: string;
  path: string;
  active: boolean;
  closable: boolean;
}

export interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  openTab: (tab: { id: string; title: string; path: string; closable?: boolean }) => void;
  updateMainTab: (tab: { title: string; path: string }) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
}
