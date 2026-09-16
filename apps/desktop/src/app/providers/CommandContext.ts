import { createContext } from "react";
import type { AppCommand } from "@shared/types/commands";

export interface CommandContextValue {
  commands: AppCommand[];
  executeCommand: (id: string) => void;
}

export const CommandContext = createContext<CommandContextValue | undefined>(undefined);
