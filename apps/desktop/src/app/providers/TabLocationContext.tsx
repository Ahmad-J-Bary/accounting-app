import { createContext, useContext } from "react";

const TabLocationContext = createContext<string>("/dashboard");

export function useTabLocation() {
  return useContext(TabLocationContext);
}

export { TabLocationContext };
