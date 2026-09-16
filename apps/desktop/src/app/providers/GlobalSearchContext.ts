import { createContext } from "react";
import type { GlobalSearchResult } from "@shared/types/navigation";

export interface GlobalSearchContextValue {
  isOpen: boolean;
  query: string;
  recent: GlobalSearchResult[];
  results: GlobalSearchResult[];
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (value: string) => void;
  activateResult: (result: GlobalSearchResult) => void;
}

export const GlobalSearchContext = createContext<GlobalSearchContextValue | undefined>(undefined);
