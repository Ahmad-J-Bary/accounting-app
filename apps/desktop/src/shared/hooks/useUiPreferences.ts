import { useContext } from "react";
import { UiPreferencesContext } from "@shared/context/UiPreferencesContext";

export const useUiPreferences = () => {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error("useUiPreferences must be used within a UiPreferencesProvider");
  }
  return context;
};
