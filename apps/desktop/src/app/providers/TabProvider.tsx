import { useState, useCallback, useRef, ReactNode, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import type { WorkspaceItem } from "@shared/types/navigation";
import type { Tab } from "@shared/types/tabs";
import type { LocalizationContextValue } from "@shared/types/i18n";
import { TabContext } from "./TabContext";
import { findRouteByPath, resolveRouteLabel } from "@app/shell/routeRegistry";
import { useLocalization } from "@app/providers/LocalizationProvider";

const MAIN_TAB_ID = "main-tab";
const WORKSPACE_STORAGE_KEY = "erp.workspace.state.v1";
const LEGACY_TAB_STORAGE_KEY = "erp.workspace.tabs";
const LEGACY_ACTIVE_TAB_STORAGE_KEY = "erp.workspace.activeTabId";
const WORKSPACE_STATE_VERSION = 1;
const MAX_CLOSED_TABS = 12;
type TranslateFn = LocalizationContextValue["t"];

interface PersistedWorkspaceState {
  version: number;
  tabs: Tab[];
  activeTabId?: string;
  closedTabs?: Tab[];
}

interface PendingCloseRequest {
  tabIds: string[];
  dirtyTitles: string[];
}

type OpenTabInput = {
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
  pinned?: boolean;
  restoreKey?: string;
  openedAt?: number;
  order?: number;
};

function normalizeWorkspacePath(path: string): string {
  const [rawPathname, rawSearch = ""] = path.split("?");
  const pathname = rawPathname && rawPathname !== "/" ? rawPathname.replace(/\/+$/, "") : rawPathname || "/";
  const params = new URLSearchParams(rawSearch);
  const orderedParams = [...params.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
    return leftKey.localeCompare(rightKey);
  });
  const normalizedSearch = new URLSearchParams();
  orderedParams.forEach(([key, value]) => normalizedSearch.append(key, value));
  const search = normalizedSearch.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function createDefaultDashboardTab(title: string): Tab {
  return {
    id: MAIN_TAB_ID,
    title,
    path: "/dashboard",
    active: true,
    closable: false,
    pinned: true,
    module: "main",
    presentationMode: "default",
    restoreKey: "main:dashboard",
    openedAt: 0,
    order: 0,
  };
}

function isWorkspaceManagedPath(path: string): boolean {
  const normalized = normalizeWorkspacePath(path);
  if (normalized === "/") return false;
  return !normalized.startsWith("/auth/") && !normalized.startsWith("/setup");
}

function buildPathDescriptor(
  rawPath: string,
  t: TranslateFn,
) {
  const normalizedPath = normalizeWorkspacePath(rawPath);
  const [pathname, search = ""] = normalizedPath.split("?");
  const searchParams = new URLSearchParams(search);
  const matchedRoute = findRouteByPath(pathname);
  const routeId = matchedRoute?.id;
  const mode = searchParams.get("mode") || "default";
  const isDraft = pathname.includes("/new-") || pathname.includes("/new/");
  const isDocument = isDraft || (!!matchedRoute && pathname !== matchedRoute.to) || searchParams.has("mode");
  const fallbackSegment = pathname.split("/").filter(Boolean).at(-1) || t("nav.page", { namespace: "shell" });

  return {
    normalizedPath,
    pathname,
    matchedRoute,
    routeId,
    module: matchedRoute?.groupId || "general",
    entity: routeId,
    entityId: isDocument ? pathname.split("/").filter(Boolean).at(-1) : undefined,
    title: matchedRoute ? resolveRouteLabel(matchedRoute.id, t) : fallbackSegment,
    restoreKey: isDraft
      ? `draft:${normalizedPath}`
      : routeId
      ? isDocument
        ? `entity:${routeId}:${pathname.split("/").filter(Boolean).at(-1) || pathname}:${mode}`
        : `route:${routeId}`
      : `path:${normalizedPath}`,
    isDocument,
  };
}

function hydrateTab(
  candidate: Tab,
  t: TranslateFn,
): Tab | null {
  if (!candidate.path || !isWorkspaceManagedPath(candidate.path)) {
    return candidate.id === MAIN_TAB_ID ? createDefaultDashboardTab(t("dashboard", { namespace: "shell" })) : null;
  }

  const descriptor = buildPathDescriptor(candidate.path, t);
  const isMainTab = candidate.id === MAIN_TAB_ID;

  return {
    id: candidate.id,
    title: candidate.title || descriptor.title,
    path: descriptor.normalizedPath,
    active: Boolean(candidate.active),
    closable: isMainTab ? false : candidate.closable ?? true,
    pinned: isMainTab ? true : candidate.pinned ?? false,
    icon: candidate.icon,
    module: candidate.module || descriptor.module,
    entity: candidate.entity || descriptor.entity,
    entityId: candidate.entityId || descriptor.entityId,
    dirty: Boolean(candidate.dirty),
    context: candidate.context,
    permissions: candidate.permissions,
    presentationMode: candidate.presentationMode || "default",
    restoreKey: candidate.restoreKey || descriptor.restoreKey,
    openedAt: candidate.openedAt ?? Date.now(),
    order: candidate.order,
  };
}

function activateTabSet(tabs: Tab[], activeTabId: string): Tab[] {
  return tabs.map((tab) => ({ ...tab, active: tab.id === activeTabId }));
}

function loadPersistedWorkspace(
  t: TranslateFn,
): { tabs: Tab[]; activeTabId: string; closedTabs: Tab[] } {
  const fallback = createDefaultDashboardTab(t("dashboard", { namespace: "shell" }));

  if (typeof window === "undefined") {
    return { tabs: [fallback], activeTabId: fallback.id, closedTabs: [] };
  }

  try {
    const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const legacyTabs = window.localStorage.getItem(LEGACY_TAB_STORAGE_KEY);
    const legacyActive = window.localStorage.getItem(LEGACY_ACTIVE_TAB_STORAGE_KEY);

    const parsed = stored
      ? (JSON.parse(stored) as PersistedWorkspaceState)
      : legacyTabs
      ? ({
          version: 0,
          tabs: JSON.parse(legacyTabs) as Tab[],
          activeTabId: legacyActive || undefined,
          closedTabs: [],
        } satisfies PersistedWorkspaceState)
      : null;

    if (!parsed || !Array.isArray(parsed.tabs)) {
      return { tabs: [fallback], activeTabId: fallback.id, closedTabs: [] };
    }

    const restoredTabs = parsed.tabs
      .map((tab) => hydrateTab(tab, t))
      .filter((tab): tab is Tab => Boolean(tab));

    const restoredClosedTabs = (parsed.closedTabs || [])
      .map((tab) => hydrateTab({ ...tab, dirty: false }, t))
      .filter((tab): tab is Tab => Boolean(tab) && tab.id !== MAIN_TAB_ID)
      .slice(0, MAX_CLOSED_TABS)
      .map((tab) => ({ ...tab, active: false, dirty: false }));

    const mainTab = restoredTabs.find((tab) => tab.id === MAIN_TAB_ID) || fallback;
    const otherTabs = restoredTabs.filter((tab) => tab.id !== MAIN_TAB_ID);
    const tabs = [mainTab, ...otherTabs];
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId) ? parsed.activeTabId! : mainTab.id;

    return {
      tabs: activateTabSet(tabs, activeTabId),
      activeTabId,
      closedTabs: restoredClosedTabs,
    };
  } catch {
    return { tabs: [fallback], activeTabId: fallback.id, closedTabs: [] };
  }
}

function toWorkspaceItem(tab: Tab): WorkspaceItem {
  return {
    id: tab.id,
    route: tab.path,
    title: tab.title,
    module: tab.module || "general",
    icon: tab.icon,
    entity: tab.entity,
    entityId: tab.entityId,
    closable: tab.closable,
    pinned: tab.pinned,
    dirty: tab.dirty,
    context: tab.context,
    permissions: tab.permissions,
    presentationMode: tab.presentationMode,
    active: tab.active,
    restoreKey: tab.restoreKey,
    openedAt: tab.openedAt,
    order: tab.order,
  };
}

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLocalization();

  const initialState = useMemo(() => loadPersistedWorkspace(t), [t]);
  const [tabs, setTabs] = useState<Tab[]>(initialState.tabs);
  const [activeTabId, setActiveTabId] = useState(initialState.activeTabId);
  const [closedTabs, setClosedTabs] = useState<Tab[]>(initialState.closedTabs);
  const [pendingCloseRequest, setPendingCloseRequest] = useState<PendingCloseRequest | null>(null);

  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);

  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;

  useEffect(() => {
    const payload: PersistedWorkspaceState = {
      version: WORKSPACE_STATE_VERSION,
      tabs: tabs.map((tab) => ({ ...tab, active: false, dirty: false })),
      activeTabId,
      closedTabs: closedTabs.map((tab) => ({ ...tab, active: false, dirty: false })),
    };

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.removeItem(LEGACY_TAB_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_ACTIVE_TAB_STORAGE_KEY);
  }, [tabs, activeTabId, closedTabs]);

  const applyTabs = useCallback(
    (
      nextTabs: Tab[],
      nextActiveTabId: string,
      navigationPath?: string,
      replace = false,
    ) => {
      const normalizedTabs = activateTabSet(nextTabs, nextActiveTabId);
      setTabs(normalizedTabs);
      setActiveTabId(nextActiveTabId);

      const targetPath = navigationPath || normalizedTabs.find((tab) => tab.id === nextActiveTabId)?.path;
      if (targetPath && normalizeWorkspacePath(location.pathname + location.search) !== normalizeWorkspacePath(targetPath)) {
        navigate(targetPath, replace ? { replace: true } : undefined);
      }
    },
    [location.pathname, location.search, navigate],
  );

  const activateTab = useCallback(
    (id: string) => {
      const target = tabsRef.current.find((tab) => tab.id === id);
      if (!target) return;
      applyTabs(tabsRef.current, id, target.path);
    },
    [applyTabs],
  );

  const updateTab = useCallback((id: string, patch: Partial<Omit<Tab, "id">>) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              ...patch,
              path: patch.path ? normalizeWorkspacePath(patch.path) : tab.path,
            }
          : tab,
      ),
    );
  }, []);

  const markDirty = useCallback(
    (id: string, dirty: boolean) => {
      updateTab(id, { dirty });
    },
    [updateTab],
  );

  const openTab = useCallback(
    (input: OpenTabInput) => {
      const descriptor = buildPathDescriptor(input.path, t);
      const normalizedPath = descriptor.normalizedPath;
      const candidate: Tab = {
        id: input.id,
        title: input.title || descriptor.title,
        path: normalizedPath,
        active: true,
        closable: input.id === MAIN_TAB_ID ? false : input.closable ?? true,
        pinned: input.id === MAIN_TAB_ID ? true : input.pinned ?? false,
        icon: input.icon,
        module: input.module || descriptor.module,
        entity: input.entity || descriptor.entity,
        entityId: input.entityId || descriptor.entityId,
        dirty: Boolean(input.dirty),
        context: input.context,
        permissions: input.permissions,
        presentationMode: input.presentationMode || "default",
        restoreKey: input.restoreKey || descriptor.restoreKey,
        openedAt: input.openedAt ?? Date.now(),
        order: input.order,
      };

      const currentTabs = tabsRef.current;
      const existing = currentTabs.find(
        (tab) => tab.id === candidate.id || tab.restoreKey === candidate.restoreKey,
      );

      if (existing) {
        const nextTabs = currentTabs.map((tab) =>
          tab.id === existing.id
            ? {
                ...tab,
                ...candidate,
                id: existing.id,
                dirty: candidate.dirty || tab.dirty,
              }
            : tab,
        );
        applyTabs(nextTabs, existing.id, candidate.path, true);
        return;
      }

      const nextTabs = [
        ...currentTabs,
        {
          ...candidate,
          order: currentTabs.length,
        },
      ];
      applyTabs(nextTabs, candidate.id, candidate.path);
    },
    [applyTabs, t],
  );

  const updateMainTab = useCallback(
    ({ title, path }: { title: string; path: string }) => {
      const descriptor = buildPathDescriptor(path, t);
      const nextTabs = tabsRef.current.map((tab) =>
        tab.id === MAIN_TAB_ID
          ? {
              ...tab,
              title,
              path: descriptor.normalizedPath,
              module: descriptor.module,
              restoreKey: `main:${descriptor.routeId || descriptor.normalizedPath}`,
              entity: descriptor.entity,
              entityId: descriptor.entityId,
            }
          : tab,
      );
      applyTabs(nextTabs, MAIN_TAB_ID, descriptor.normalizedPath);
    },
    [applyTabs, t],
  );

  const openDashboardTab = useCallback(() => {
    const dashboardId = `dashboard-${Date.now()}`;
    openTab({
      id: dashboardId,
      title: t("dashboard", { namespace: "shell" }),
      path: "/dashboard",
      closable: true,
      pinned: false,
      restoreKey: `dashboard:${dashboardId}`,
    });
  }, [openTab, t]);

  const pushClosedTabs = useCallback((closingTabs: Tab[]) => {
    if (closingTabs.length === 0) return;
    setClosedTabs((prev) =>
      [...closingTabs.map((tab) => ({ ...tab, active: false, dirty: false })), ...prev]
        .filter((tab, index, array) => array.findIndex((item) => item.id === tab.id) === index)
        .slice(0, MAX_CLOSED_TABS),
    );
  }, []);

  const closeTabsInternal = useCallback(
    (tabIds: string[]) => {
      const currentTabs = tabsRef.current;
      const ids = new Set(tabIds);
      const closingTabs = currentTabs.filter((tab) => ids.has(tab.id) && tab.closable);
      if (closingTabs.length === 0) return;

      pushClosedTabs(closingTabs);

      const remainingTabs = currentTabs.filter((tab) => !ids.has(tab.id));
      const currentIndex = currentTabs.findIndex((tab) => tab.id === activeTabIdRef.current);
      const currentStillExists = remainingTabs.some((tab) => tab.id === activeTabIdRef.current);
      const fallbackIndex = Math.max(0, Math.min(currentIndex, remainingTabs.length - 1));
      const nextActiveTabId = currentStillExists
        ? activeTabIdRef.current
        : remainingTabs[fallbackIndex]?.id || MAIN_TAB_ID;

      applyTabs(remainingTabs, nextActiveTabId, remainingTabs.find((tab) => tab.id === nextActiveTabId)?.path, true);
    },
    [applyTabs, pushClosedTabs],
  );

  const requestCloseTabs = useCallback((tabIds: string[]) => {
    const closableTabs = tabsRef.current.filter((tab) => tabIds.includes(tab.id) && tab.closable);
    if (closableTabs.length === 0) return;

    const dirtyTitles = closableTabs.filter((tab) => tab.dirty).map((tab) => tab.title);
    if (dirtyTitles.length > 0) {
      setPendingCloseRequest({ tabIds: closableTabs.map((tab) => tab.id), dirtyTitles });
      return;
    }

    closeTabsInternal(closableTabs.map((tab) => tab.id));
  }, [closeTabsInternal]);

  const closeTab = useCallback((id: string) => requestCloseTabs([id]), [requestCloseTabs]);

  const closeOtherTabs = useCallback(
    (id: string) => {
      const targetIds = tabsRef.current
        .filter((tab) => tab.id !== id && tab.closable)
        .map((tab) => tab.id);
      requestCloseTabs(targetIds);
    },
    [requestCloseTabs],
  );

  const closeTabsToRight = useCallback(
    (id: string) => {
      const index = tabsRef.current.findIndex((tab) => tab.id === id);
      if (index === -1) return;
      const targetIds = tabsRef.current.slice(index + 1).filter((tab) => tab.closable).map((tab) => tab.id);
      requestCloseTabs(targetIds);
    },
    [requestCloseTabs],
  );

  const closeTabsToLeft = useCallback(
    (id: string) => {
      const index = tabsRef.current.findIndex((tab) => tab.id === id);
      if (index === -1) return;
      const targetIds = tabsRef.current.slice(0, index).filter((tab) => tab.closable).map((tab) => tab.id);
      requestCloseTabs(targetIds);
    },
    [requestCloseTabs],
  );

  const closeAllTabs = useCallback(() => {
    const targetIds = tabsRef.current.filter((tab) => tab.closable).map((tab) => tab.id);
    requestCloseTabs(targetIds);
  }, [requestCloseTabs]);

  const reopenLastClosedTab = useCallback(() => {
    const [lastClosed, ...rest] = closedTabs;
    if (!lastClosed) return;
    setClosedTabs(rest);
    openTab({
      ...lastClosed,
      id: lastClosed.id,
      dirty: false,
    });
  }, [closedTabs, openTab]);

  const duplicateTab = useCallback(
    (id: string) => {
      const current = tabsRef.current.find((tab) => tab.id === id);
      if (!current) return;
      openTab({
        ...current,
        id: `${current.id}-copy-${Date.now()}`,
        restoreKey: `${current.restoreKey || current.path}:copy:${Date.now()}`,
        dirty: false,
      });
    },
    [openTab],
  );

  const pinTab = useCallback((id: string) => updateTab(id, { pinned: true }), [updateTab]);
  const unpinTab = useCallback((id: string) => updateTab(id, { pinned: false }), [updateTab]);

  const nextTab = useCallback(() => {
    const current = tabsRef.current;
    if (current.length <= 1) return;
    const currentIndex = current.findIndex((tab) => tab.id === activeTabIdRef.current);
    const nextIndex = (currentIndex + 1) % current.length;
    activateTab(current[nextIndex].id);
  }, [activateTab]);

  const prevTab = useCallback(() => {
    const current = tabsRef.current;
    if (current.length <= 1) return;
    const currentIndex = current.findIndex((tab) => tab.id === activeTabIdRef.current);
    const prevIndex = (currentIndex - 1 + current.length) % current.length;
    activateTab(current[prevIndex].id);
  }, [activateTab]);

  const firstTab = useCallback(() => {
    const first = tabsRef.current[0];
    if (first) activateTab(first.id);
  }, [activateTab]);

  const lastTab = useCallback(() => {
    const last = tabsRef.current.at(-1);
    if (last) activateTab(last.id);
  }, [activateTab]);

  const switchTab = useCallback((id: string) => activateTab(id), [activateTab]);

  useEffect(() => {
    const currentPath = normalizeWorkspacePath(location.pathname + location.search);
    if (!isWorkspaceManagedPath(currentPath)) return;

    const currentTabs = tabsRef.current;
    const currentDescriptor = buildPathDescriptor(currentPath, t);
    const matchingTab =
      currentTabs.find((tab) => tab.id !== MAIN_TAB_ID && tab.restoreKey === currentDescriptor.restoreKey) ||
      currentTabs.find((tab) => tab.id !== MAIN_TAB_ID && normalizeWorkspacePath(tab.path) === currentPath) ||
      currentTabs.find((tab) => tab.id === MAIN_TAB_ID && normalizeWorkspacePath(tab.path) === currentPath) ||
      currentTabs.find((tab) => tab.restoreKey === currentDescriptor.restoreKey);

    if (matchingTab) {
      const needsPathSync = normalizeWorkspacePath(matchingTab.path) !== currentPath;
      const needsActiveSync = matchingTab.id !== activeTabIdRef.current;

      if (needsPathSync || needsActiveSync) {
        const nextTabs = currentTabs.map((tab) =>
          tab.id === matchingTab.id
            ? {
                ...tab,
                path: currentPath,
                module: tab.module || currentDescriptor.module,
                entity: tab.entity || currentDescriptor.entity,
                entityId: tab.entityId || currentDescriptor.entityId,
              }
            : tab,
        );
        applyTabs(nextTabs, matchingTab.id);
      }
      return;
    }

    if (currentDescriptor.isDocument) {
      openTab({
        id: `${currentDescriptor.restoreKey}:${Date.now()}`,
        title: currentDescriptor.title,
        path: currentPath,
        closable: true,
        module: currentDescriptor.module,
        entity: currentDescriptor.entity,
        entityId: currentDescriptor.entityId,
        restoreKey: currentDescriptor.restoreKey,
      });
      return;
    }

    const nextTabs = currentTabs.map((tab) =>
      tab.id === MAIN_TAB_ID
        ? {
            ...tab,
            title: currentDescriptor.title,
            path: currentPath,
            module: currentDescriptor.module,
            entity: currentDescriptor.entity,
            entityId: currentDescriptor.entityId,
            restoreKey: `main:${currentDescriptor.routeId || currentDescriptor.normalizedPath}`,
          }
        : tab,
    );
    applyTabs(nextTabs, MAIN_TAB_ID);
  }, [applyTabs, location.pathname, location.search, openTab, t]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = event.ctrlKey || event.metaKey;
      if (!modifierPressed) return;

      if (event.key.toLowerCase() === "w" || event.code === "KeyW") {
        event.preventDefault();
        closeTab(activeTabIdRef.current);
        return;
      }

      if (event.key.toLowerCase() === "t" || event.code === "KeyT") {
        event.preventDefault();
        openDashboardTab();
        return;
      }

      if (event.code === "Tab" || event.key === "Tab" || event.code === "PageDown" || event.key === "PageDown") {
        event.preventDefault();
        if (event.shiftKey) {
          prevTab();
        } else {
          nextTab();
        }
        return;
      }

      if (event.code === "PageUp" || event.key === "PageUp") {
        event.preventDefault();
        prevTab();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeTab, nextTab, openDashboardTab, prevTab]);

  const workspaceItems = useMemo(() => tabs.map(toWorkspaceItem), [tabs]);

  const pendingCloseTitle = pendingCloseRequest
    ? pendingCloseRequest.dirtyTitles.length === 1
      ? t("workspace.unsavedChanges.titleSingle", { namespace: "shell" })
      : t("workspace.unsavedChanges.titleMultiple", { namespace: "shell" })
    : "";

  const pendingCloseDescription = pendingCloseRequest
    ? pendingCloseRequest.dirtyTitles.length === 1
      ? t("workspace.unsavedChanges.descriptionSingle", {
          namespace: "shell",
          vars: { title: pendingCloseRequest.dirtyTitles[0] },
        })
      : t("workspace.unsavedChanges.descriptionMultiple", {
          namespace: "shell",
          vars: { count: String(pendingCloseRequest.dirtyTitles.length) },
        })
    : "";

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        workspaceItems,
        openTab,
        activateTab,
        updateMainTab,
        closeTab,
        closeOtherTabs,
        closeTabsToRight,
        closeTabsToLeft,
        closeAllTabs,
        reopenLastClosedTab,
        duplicateTab,
        switchTab,
        updateTab,
        pinTab,
        unpinTab,
        nextTab,
        prevTab,
        firstTab,
        lastTab,
        markDirty,
        openDashboardTab,
      }}
    >
      {children}
      <ConfirmDialog
        open={Boolean(pendingCloseRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCloseRequest(null);
          }
        }}
        title={pendingCloseTitle}
        description={pendingCloseDescription}
        confirmLabel={t("workspace.unsavedChanges.confirmClose", { namespace: "shell" })}
        cancelLabel={t("workspace.unsavedChanges.cancel", { namespace: "shell" })}
        destructive
        onConfirm={() => {
          if (!pendingCloseRequest) return;
          const ids = pendingCloseRequest.tabIds;
          setPendingCloseRequest(null);
          closeTabsInternal(ids);
        }}
      />
    </TabContext.Provider>
  );
};
