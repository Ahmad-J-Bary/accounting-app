import React, { createContext, useContext, useMemo, useState } from "react";
import type { NavigationDestination, WindowWorkspaceState } from "@shared/types/navigation";

interface WindowContextValue {
  windows: WindowWorkspaceState[];
  openDestinationInWindow: (destination: NavigationDestination) => Promise<void>;
  closeWindow: (windowId: string) => Promise<void>;
}

const WindowContext = createContext<WindowContextValue | undefined>(undefined);

async function createNativeWindow(windowId: string, route: string, title: string) {
  const module = await import("@tauri-apps/api/webviewWindow");
  const { WebviewWindow } = module;
  return new WebviewWindow(windowId, {
    url: route,
    title,
    width: 1280,
    height: 860,
    resizable: true,
  });
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowWorkspaceState[]>([]);

  const value = useMemo<WindowContextValue>(
    () => ({
      windows,
      openDestinationInWindow: async (destination) => {
        const windowId = `workspace-window-${Date.now()}`;
        try {
          await createNativeWindow(windowId, destination.route, destination.title);
          setWindows((current) => [
            ...current,
            {
              id: windowId,
              label: destination.title,
              activeItemId: destination.id,
              permissions: destination.permissions,
              context: destination.context,
            },
          ]);
        } catch (error) {
          console.warn("Window creation is unavailable in the current environment", error);
        }
      },
      closeWindow: async (windowId) => {
        try {
          const module = await import("@tauri-apps/api/webviewWindow");
          const windows = await module.getAllWebviewWindows();
          const target = windows.find((windowRef) => windowRef.label === windowId);
          await target?.close();
        } catch (error) {
          console.warn("Window closing is unavailable in the current environment", error);
        } finally {
          setWindows((current) => current.filter((windowState) => windowState.id !== windowId));
        }
      },
    }),
    [windows],
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

export function useWindowManager() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error("useWindowManager must be used within WindowProvider");
  }
  return context;
}
