import { createContext, useContext } from "react";
import type { NavigationDestination, WindowWorkspaceState } from "@shared/types/navigation";

export interface WindowCapability {
  available: boolean;
  reason?: string;
}

export interface WindowContextValue {
  windows: WindowWorkspaceState[];
  capability: WindowCapability;
  openDestinationInWindow: (destination: NavigationDestination) => Promise<void>;
  closeWindow: (windowId: string) => Promise<void>;
}

export const WindowContext = createContext<WindowContextValue | undefined>(undefined);

export function useWindowManager() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error("useWindowManager must be used within WindowProvider");
  }
  return context;
}
