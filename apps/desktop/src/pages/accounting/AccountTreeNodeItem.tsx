import { ChevronDown, ChevronLeft, File, Folder, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { TYPE_LABELS, type AccountTreeNode, type ToggleNodeHandler } from "./types";
import { isSummaryAccount, parseAmount } from "./tree-utils";

interface AccountTreeNodeItemProps {
  account: AccountTreeNode;
  level?: number;
  selectedId: string;
  onSelect: (account: AccountTreeNode) => void;
  expandedNodes: Set<string>;
  toggleNode: ToggleNodeHandler;
}

export function AccountTreeNodeItem({
  account,
  level = 0,
  selectedId,
  onSelect,
  expandedNodes,
  toggleNode,
}: AccountTreeNodeItemProps) {
  const isExpanded = expandedNodes.has(account.id);
  const hasChildren = account.children.length > 0;
  const isSelected = selectedId === account.id;
  const isSummary = isSummaryAccount(account);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 border-b border-border/40 cursor-pointer transition-colors hover:bg-slate-50",
          isSelected && "bg-primary/5 border-l-2 border-l-primary",
          isSummary ? "font-bold text-slate-800" : "text-sm text-slate-600",
        )}
        style={{ paddingRight: `${level * 24 + 12}px` }}
        onClick={() => onSelect(account)}
      >
        <div className="flex items-center gap-1 w-[40px]">
          {hasChildren ? (
            <button
              onClick={(event) => toggleNode(account.id, event)}
              className="p-1 hover:bg-slate-200 rounded text-slate-500"
              type="button"
              aria-label={isExpanded ? "طي العقدة" : "توسيع العقدة"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-1">
          {isSummary ? (
            <Folder className="w-4 h-4 text-slate-400" />
          ) : (
            <File className="w-4 h-4 text-slate-300" />
          )}

          <span className="tabular-nums min-w-[60px]">{account.code}</span>
          <span className="flex-1">{account.name_ar}</span>

          {account.is_default && (
            <span className="inline-flex" aria-label="حساب افتراضي">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500 ml-1" />
            </span>
          )}

          {!account.is_active && (
            <span className="inline-flex" aria-label="حساب معطل">
              <Lock className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </span>
          )}
        </div>

        <div className="w-[100px] text-xs">
          {isSummary ? (
            <span className="text-slate-400">تجميعي</span>
          ) : (
            <span className="text-slate-500">فرعي</span>
          )}
        </div>

        <div className="w-[120px]">
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border",
              TYPE_LABELS[account.account_type]?.color || "",
            )}
          >
            {TYPE_LABELS[account.account_type]?.label || account.account_type}
          </span>
        </div>

        <div className="w-[120px] text-left tabular-nums">
          {formatCurrency(parseAmount(account.balance))}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {account.children.map((child) => (
            <AccountTreeNodeItem
              key={child.id}
              account={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
