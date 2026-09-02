import { useState, useCallback, useRef, ReactNode, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { WorkspaceItem } from '@shared/types/navigation';
import type { Tab } from '@shared/types/tabs';
import { TabContext } from './TabContext';
import { findRouteByPath } from '@app/shell/routeRegistry';

const TAB_STORAGE_KEY = "erp.workspace.tabs";
const ACTIVE_TAB_STORAGE_KEY = "erp.workspace.activeTabId";

const DEFAULT_DASHBOARD_TAB: Tab = {
  id: 'main-tab',
  title: 'لوحة التحكم',
  path: '/dashboard',
  active: true,
  closable: false,
  module: 'dashboard',
  presentationMode: 'default',
};

function toWorkspaceItem(tab: Tab): WorkspaceItem {
  return {
    id: tab.id,
    route: tab.path,
    title: tab.title,
    module: tab.module || findRouteByPath(tab.path)?.groupId || "general",
    icon: tab.icon,
    entity: tab.entity,
    entityId: tab.entityId,
    closable: tab.closable,
    dirty: tab.dirty,
    context: tab.context,
    permissions: tab.permissions,
    presentationMode: tab.presentationMode,
    active: tab.active,
    restoreKey: tab.restoreKey,
  };
}

function restoreTabs(): Tab[] {
  if (typeof window === "undefined") return [DEFAULT_DASHBOARD_TAB];
  try {
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw) return [DEFAULT_DASHBOARD_TAB];
    const parsed = JSON.parse(raw) as Tab[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_DASHBOARD_TAB];
    const hasMainTab = parsed.some((tab) => tab.id === DEFAULT_DASHBOARD_TAB.id);
    return hasMainTab ? parsed : [DEFAULT_DASHBOARD_TAB, ...parsed];
  } catch {
    return [DEFAULT_DASHBOARD_TAB];
  }
}

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [tabs, setTabs] = useState<Tab[]>(restoreTabs);
  const [activeTabId, setActiveTabId] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_DASHBOARD_TAB.id;
    return window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || DEFAULT_DASHBOARD_TAB.id;
  });
  const navigate = useNavigate();
  const location = useLocation();
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
  }, [activeTabId]);

  const activateTab = useCallback((id: string, path?: string, replace = false) => {
    const tab = tabsRef.current.find((item) => item.id === id);
    if (!tab) return;
    setTabs((prev) => prev.map((item) => ({ ...item, active: item.id === id })));
    setActiveTabId(id);
    navigate(path ?? tab.path, replace ? { replace: true } : undefined);
  }, [navigate]);

  const switchTab = useCallback((id: string) => {
    activateTab(id);
  }, [activateTab]);

  const updateMainTab = useCallback((newTab: { title: string; path: string }) => {
    setTabs(prev => prev.map(t => 
      t.id === 'main-tab' 
        ? { ...t, title: newTab.title, path: newTab.path, active: true, module: findRouteByPath(newTab.path)?.groupId || "general" }
        : { ...t, active: false }
    ));
    setActiveTabId('main-tab');
    navigate(newTab.path);
  }, [navigate]);

  const openDashboardTab = useCallback(() => {
    const current = tabsRef.current;
    const uniqueId = `dashboard-${Date.now()}`;
    setTabs([
      ...current.map((tab) => ({ ...tab, active: false })),
      { ...DEFAULT_DASHBOARD_TAB, id: uniqueId, closable: true, active: true },
    ]);
    setActiveTabId(uniqueId);
    navigate(DEFAULT_DASHBOARD_TAB.path);
  }, [navigate]);

  const nextTab = useCallback(() => {
    const current = tabsRef.current;
    if (current.length <= 1) return;
    const currentIndex = current.findIndex(t => t.active);
    const nextIndex = (currentIndex + 1) % current.length;
    const target = current[nextIndex];
    setTabs(prev => prev.map((t, i) => ({ ...t, active: i === nextIndex })));
    setActiveTabId(target.id);
    navigate(target.path);
  }, [navigate]);

  const prevTab = useCallback(() => {
    const current = tabsRef.current;
    if (current.length <= 1) return;
    const currentIndex = current.findIndex(t => t.active);
    const prevIndex = (currentIndex - 1 + current.length) % current.length;
    const target = current[prevIndex];
    setTabs(prev => prev.map((t, i) => ({ ...t, active: i === prevIndex })));
    setActiveTabId(target.id);
    navigate(target.path);
  }, [navigate]);

  const openTab = useCallback((newTab: {
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
    presentationMode?: "default" | "browser" | "vscode";
  }) => {
    const current = tabsRef.current;

    const exists = current.find(t => t.id === newTab.id);
    if (exists) {
      setTabs(prev => prev.map(t => ({ ...t, ...newTab, active: t.id === newTab.id })));
      setActiveTabId(newTab.id);
      navigate(newTab.path, { replace: true });
      return;
    }

    const existingByPath = current.find(t => t.path === newTab.path && t.entityId === newTab.entityId);
    if (existingByPath) {
      setTabs(prev => prev.map(t => ({ ...t, active: t.id === existingByPath.id })));
      setActiveTabId(existingByPath.id);
      navigate(newTab.path, { replace: true });
      return;
    }

    const resolvedRoute = findRouteByPath(newTab.path);
    setTabs(prev => [
      ...prev.map(t => ({ ...t, active: false })),
      {
        ...newTab,
        active: true,
        closable: newTab.closable ?? true,
        module: newTab.module || resolvedRoute?.groupId || "general",
        presentationMode: newTab.presentationMode || "default",
      },
    ]);
    setActiveTabId(newTab.id);
    navigate(newTab.path);
  }, [navigate]);

  const markDirty = useCallback((id: string, dirty: boolean) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, dirty } : tab)));
  }, []);

  const closeTab = useCallback((id: string) => {
    const current = tabsRef.current;
    const tabToClose = current.find(t => t.id === id);
    if (!tabToClose || !tabToClose.closable) return;

    if (tabToClose.dirty && !window.confirm(`لديك تغييرات غير محفوظة في «${tabToClose.title}». هل تريد الإغلاق؟`)) {
      return;
    }

    const wasActive = tabToClose.active;
    const remainingTabs = current.filter(t => t.id !== id);

    setTabs(prev => prev.filter(t => t.id !== id));

    if (wasActive && remainingTabs.length > 0) {
      const lastTab = remainingTabs[remainingTabs.length - 1];
      setActiveTabId(lastTab.id);
      navigate(lastTab.path, { replace: true });
    }
  }, [navigate]);

  // Handle browser back/forward (popstate only — not triggered by our own navigate())
  useEffect(() => {
    const handlePopState = () => {
      const currentFullPath = window.location.pathname + window.location.search;
      const currentTabs = tabsRef.current;

      const existingTab = currentTabs.find(t => t.path === currentFullPath);
      if (existingTab) {
        if (existingTab.id !== activeTabIdRef.current) {
          setActiveTabId(existingTab.id);
          setTabs(prev => prev.map(t => ({ ...t, active: t.id === existingTab.id })));
        }
        return;
      }

      // No tab matches — back/forward to a path outside open tabs
      if (currentFullPath !== '/' && !currentFullPath.startsWith('/auth/') && !currentFullPath.startsWith('/setup')) {
        // New-document paths (e.g. /sales-invoices/new-12345) — redirect to parent list
        if (currentFullPath.includes('/new-')) {
          const parentPath = currentFullPath.substring(0, currentFullPath.lastIndexOf('/'));
          setTabs(prev => prev.map(t =>
            t.id === 'main-tab'
              ? { ...t, path: parentPath, active: true }
              : { ...t, active: false }
          ));
          setActiveTabId('main-tab');
          navigate(parentPath, { replace: true });
          return;
        }

        // Document patterns (invoices, returns, opening-balance, account-ledger, statements)
        const isDocumentPath = /^\/(sales-invoices|purchase-invoices|sales-returns|purchase-returns|opening-balance|accounting\/account-ledger|partners\/(customer|supplier)-statement)\/[^/]+/.test(currentFullPath);

        if (isDocumentPath) {
          const id = `nav-${Date.now()}`;
          const resolvedRoute = findRouteByPath(currentFullPath);
          const title = resolvedRoute?.label || currentFullPath.split('/').pop() || 'صفحة';
          setTabs(prev => [...prev.map(t => ({ ...t, active: false })), {
            id,
            title,
            path: currentFullPath,
            active: true,
            closable: true,
            module: resolvedRoute?.groupId || "general",
            presentationMode: "default",
          }]);
          setActiveTabId(id);
        } else {
          setTabs(prev => prev.map(t => 
            t.id === 'main-tab' 
              ? { ...t, path: currentFullPath, active: true }
              : { ...t, active: false }
          ));
          setActiveTabId('main-tab');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  // Sync browser URL to active tab when URL changes from our own navigate() calls
  useEffect(() => {
    const currentFullPath = location.pathname + location.search;
    const currentActiveTab = tabsRef.current.find(t => t.active);
    if (currentActiveTab && currentActiveTab.path !== currentFullPath) {
      // Our navigate() may have changed the URL — ensure the active tab reflects it
      const matchingTab = tabsRef.current.find(t => t.path === currentFullPath);
      if (matchingTab && matchingTab.id !== activeTabIdRef.current) {
        setActiveTabId(matchingTab.id);
        setTabs(prev => prev.map(t => ({ ...t, active: t.id === matchingTab.id })));
      }
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.active)) {
      setTabs((prev) => prev.map((tab, index) => ({ ...tab, active: index === 0 })));
    }
  }, [tabs]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
          e.preventDefault();
          closeTab(activeTabIdRef.current);
        }
        else if (e.code === 'KeyT' || e.key.toLowerCase() === 't') {
          e.preventDefault();
          openDashboardTab();
        }
        else if (e.code === 'Tab' || e.key === 'Tab' || e.code === 'PageDown' || e.key === 'PageDown') {
          e.preventDefault();
          if (e.shiftKey) {
            prevTab();
          } else {
            nextTab();
          }
        }
        else if (e.code === 'PageUp' || e.key === 'PageUp') {
          e.preventDefault();
          prevTab();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closeTab, nextTab, openDashboardTab, prevTab]);

  const workspaceItems = useMemo(() => tabs.map(toWorkspaceItem), [tabs]);

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        workspaceItems,
        openTab,
        updateMainTab,
        closeTab,
        switchTab,
        nextTab,
        prevTab,
        markDirty,
        openDashboardTab,
      }}
    >
      {children}
    </TabContext.Provider>
  );
};
