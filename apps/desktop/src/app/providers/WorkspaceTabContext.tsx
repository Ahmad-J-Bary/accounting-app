import { createContext, useContext } from "react";

interface WorkspaceTabContextValue {
  tabId: string;
  path: string;
  active: boolean;
}

export const WorkspaceTabContext = createContext<WorkspaceTabContextValue | null>(null);

export function useWorkspaceTab() {
  const context = useContext(WorkspaceTabContext);
  if (!context) {
    throw new Error("useWorkspaceTab must be used within WorkspaceTabContext");
  }
  return context;
}
