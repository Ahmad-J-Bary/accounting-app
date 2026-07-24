import { createContext, useContext, type ReactNode } from "react";
import { useUpdateChecker } from "../hooks/useUpdateChecker";

const UpdateContext = createContext<ReturnType<typeof useUpdateChecker> | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const updateState = useUpdateChecker();

  return (
    <UpdateContext.Provider value={updateState}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate(): ReturnType<typeof useUpdateChecker> {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error("useUpdate must be used within an <UpdateProvider>");
  }
  return ctx;
}
