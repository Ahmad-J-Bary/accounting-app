import { useContext } from "react";
import { CommandContext } from "./CommandContext";

export function useCommands() {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error("useCommands must be used within CommandProvider");
  }
  return context;
}
