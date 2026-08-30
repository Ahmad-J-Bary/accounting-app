import {
  resolveAccountNode,
  inferFixedAssetType,
  type ResolveAccountNodeContext,
} from "@shared/tree/entityResolver";
import { BRANCH_LABELS, CREATE_LABELS } from "@shared/tree/actionsResolver";
import type {
  ResolvedTreeNode,
  TreeNodeCreatePanelKind,
} from "@shared/tree/nodeTypes";
import type { FixedAssetType } from "@shared/tree/fixedAssetTypes";

/**
 * Chart-of-accounts branch helpers. The classification itself lives in the
 * shared entity resolver (single source of truth); this module only re-exports
 * ergonomic conveniences for the COA page and panel.
 */

export const resolveChartNode = (ctx: ResolveAccountNodeContext): ResolvedTreeNode =>
  resolveAccountNode(ctx);

export const chartBranchLabel = (branch: ResolvedTreeNode["branch"]): string =>
  BRANCH_LABELS[branch];

export const chartCreateLabel = (
  kind: TreeNodeCreatePanelKind | null,
): string => (kind ? CREATE_LABELS[kind] : "جديد");

export { inferFixedAssetType };

export type { ResolvedTreeNode, TreeNodeCreatePanelKind, FixedAssetType };