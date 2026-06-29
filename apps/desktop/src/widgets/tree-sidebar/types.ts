import { ReactNode } from "react";

export interface BaseTreeNode {
  id: string;
  parent_id: string | null;
  children: BaseTreeNode[];
}

export type ToggleNodeHandler = (id: string, event: React.MouseEvent) => void;

export interface TreeItemProps<T extends BaseTreeNode> {
  node: T;
  level: number;
  selectedId: string;
  onSelect: (node: T) => void;
  expandedNodes: Set<string>;
  onToggle: ToggleNodeHandler;
  renderIcon: (node: T, isExpanded: boolean) => ReactNode;
  renderLabel: (node: T) => ReactNode;
  renderRight?: (node: T) => ReactNode;
  isVirtualRoot?: boolean;
  virtualRootId?: string;
  /** Flags indicating if the node at each level (0..level-1) has a next sibling */
  siblingFlags?: boolean[];
}
