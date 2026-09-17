import type { LucideIcon } from "lucide-react";

/**
 * Shared descriptor for all row-level actions across tables.
 * Used as a single source of truth for:
 * - Table row right-click ContextMenu
 * - Table cell action column / kebab DropdownMenu
 * - Direct row button actions
 */
export interface RowActionDescriptor<T = unknown> {
  /** Unique action identifier */
  id: string;
  /** Localized display label */
  label: string;
  /** Action icon */
  icon?: LucideIcon;
  /** Priority for visible vs overflow rendering */
  priority?: "primary" | "secondary" | "tertiary" | "overflow";
  /** Button / menu variant */
  variant?: "default" | "destructive" | "outline" | "ghost";
  /** Whether this action is destructive (triggers confirmation / red styling) */
  destructive?: boolean;
  /** Disabled state or predicate based on current row record */
  disabled?: boolean | ((row: T) => boolean);
  /** Hidden state or predicate based on current row record or permissions */
  hidden?: boolean | ((row: T) => boolean);
  /** Add a separator before or after this action item */
  separator?: "before" | "after";
  /** Click / execution handler */
  onClick: (row: T) => void | Promise<void>;
}
