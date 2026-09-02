import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_SYSTEM_ROUTES } from "@app/shell/routeRegistry";
import { useCommands } from "@app/providers/CommandProvider";
import { useTabs } from "@app/providers/TabContext";
import type { GlobalSearchResult } from "@shared/types/navigation";

interface GlobalSearchContextValue {
  isOpen: boolean;
  query: string;
  recent: GlobalSearchResult[];
  results: GlobalSearchResult[];
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (value: string) => void;
  activateResult: (result: GlobalSearchResult) => void;
}

const RECENT_LIMIT = 8;
const SEARCH_RECENT_STORAGE_KEY = "erp.search.recent";

const GlobalSearchContext = createContext<GlobalSearchContextValue | undefined>(undefined);

function loadRecent(): GlobalSearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GlobalSearchResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { commands, executeCommand } = useCommands();
  const { tabs, switchTab, openTab } = useTabs();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<GlobalSearchResult[]>(loadRecent);

  const routeResults = useMemo<GlobalSearchResult[]>(
    () =>
      ALL_SYSTEM_ROUTES.filter((route) => !route.isSeparator && route.to).map((route) => ({
        id: `route:${route.id}`,
        type: "route",
        title: route.label,
        subtitle: route.groupLabel,
        icon: route.icon,
        destination: { route: route.to },
        group: "navigation",
        keywords: [route.label, route.id, route.groupLabel],
      })),
    [],
  );

  const commandResults = useMemo<GlobalSearchResult[]>(
    () =>
      commands.map((command) => ({
        id: `command:${command.id}`,
        type: "command",
        title: command.title,
        subtitle: command.subtitle || command.group,
        icon: command.icon,
        group: "commands",
        keywords: [command.title, ...(command.keywords || [])],
      })),
    [commands],
  );

  const tabResults = useMemo<GlobalSearchResult[]>(
    () =>
      tabs
        .filter((tab) => tab.closable)
        .map((tab) => ({
          id: `tab:${tab.id}`,
          type: "tab",
          title: tab.title,
          subtitle: tab.path,
          icon: tab.icon,
          destination: { route: tab.path, entityId: tab.entityId, presentationMode: tab.presentationMode },
          entityId: tab.entityId,
          group: "tabs",
          keywords: [tab.title, tab.path, tab.module || ""],
        })),
    [tabs],
  );

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [...recent, ...commandResults].slice(0, 12);
    const haystack = [...routeResults, ...commandResults, ...tabResults];
    return haystack.filter((item) =>
      [item.title, item.subtitle || "", ...(item.keywords || [])]
        .join(" ")
        .toLowerCase()
        .includes(trimmed),
    );
  }, [commandResults, query, recent, routeResults, tabResults]);

  const persistRecent = useCallback((items: GlobalSearchResult[]) => {
    setRecent(items);
    window.localStorage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify(items));
  }, []);

  const activateResult = useCallback(
    (result: GlobalSearchResult) => {
      const nextRecent = [result, ...recent.filter((item) => item.id !== result.id)].slice(0, RECENT_LIMIT);
      persistRecent(nextRecent);

      if (result.type === "command") {
        executeCommand(result.id.replace("command:", ""));
      } else if (result.type === "tab") {
        switchTab(result.id.replace("tab:", ""));
      } else if (result.destination) {
        const route = result.destination.route;
        const existing = tabs.find((tab) => tab.path === route);
        if (existing) {
          switchTab(existing.id);
        } else {
          openTab({
            id: `search-${Date.now()}`,
            title: result.title,
            path: route,
            icon: result.icon,
            entityId: result.entityId,
            presentationMode: result.destination.presentationMode,
          });
        }
        navigate(route);
      }

      setIsOpen(false);
      setQuery("");
    },
    [executeCommand, navigate, openTab, persistRecent, recent, switchTab, tabs],
  );

  const value = useMemo<GlobalSearchContextValue>(
    () => ({
      isOpen,
      query,
      recent,
      results,
      openSearch: () => setIsOpen(true),
      closeSearch: () => {
        setIsOpen(false);
        setQuery("");
      },
      setQuery,
      activateResult,
    }),
    [activateResult, isOpen, query, recent, results],
  );

  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>;
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
  }
  return context;
}
