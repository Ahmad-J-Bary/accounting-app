import React, { useMemo, useState } from "react";
import type { WindowCapability, WindowContextValue } from "./WindowContext";
import { WindowContext } from "./WindowContext";
import type { WindowWorkspaceState } from "@shared/types/navigation";

async function createNativeWindow(windowId: string, route: string, title: string) {
  const module = await import("@tauri-apps/api/webviewWindow");
  const { WebviewWindow } = module;
  return new WebviewWindow(windowId, {
    url: route,
    title,
    width: 1280,
    height: 860,
    resizable: true,
    decorations: false,
    shadow: true,
  });
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowWorkspaceState[]>([]);

  const capability = useMemo<WindowCapability>(
    () => ({
      // Native windows already exist at the Tauri layer, but workspace persistence is
      // still global to the app, so opening a second workspace window would share and
      // overwrite the same session storage.
      available: false,
      reason: "Deferred until workspace persistence is scoped per window.",
    }),
    [],
  );

  const value = useMemo<WindowContextValue>(
    () => ({
      windows,
      capability,
      openDestinationInWindow: async (destination) => {
        if (!capability.available) {
          console.warn("Native workspace windows are not enabled yet", {
            destination,
            reason: capability.reason,
          });
          return;
        }

        const windowId = `workspace-window-${Date.now()}`;
        try {
          await createNativeWindow(windowId, destination.route, destination.title);
          setWindows((current) => [
            ...current,
            {
              id: windowId,
              label: destination.title,
              route: destination.route,
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
    [capability, windows],
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}
