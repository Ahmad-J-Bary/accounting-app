import { FileText, FolderOpen, Folder, Lock, ShieldCheck, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { TYPE_LABELS, type AccountTreeNode, type ToggleNodeHandler } from "./types";
import { isSummaryAccount, parseAmount } from "./tree-utils";
import { TreeItem } from "../../components/erp/tree-management/TreeItem";

interface AccountTreeNodeItemProps {
  account: AccountTreeNode;
  level?: number;
  selectedId: string;
  onSelect: (account: AccountTreeNode) => void;
  expandedNodes: Set<string>;
  toggleNode: ToggleNodeHandler;
  virtualRootId?: string;
}

export function AccountTreeNodeItem({
  account,
  level = 0,
  selectedId,
  onSelect,
  expandedNodes,
  toggleNode,
  virtualRootId,
}: AccountTreeNodeItemProps) {
  const isVirtualRoot = virtualRootId === account.id;
  const isSummary = isVirtualRoot || isSummaryAccount(account);

  const renderIcon = (node: AccountTreeNode, isExpanded: boolean) => {
    if (isVirtualRoot) return <FolderOpen className="w-4 h-4 text-primary" />;
    if (node.is_final) return <FileText className="w-4 h-4 text-emerald-500" />;
    if (isSummaryAccount(node)) return isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const renderLabel = (node: AccountTreeNode) => {
    const codeDigits = Math.max(1, node.level ?? 0);
    const rawCode = (node.code ?? "").toString();
    const displayCode = rawCode.length < codeDigits
      ? rawCode.padStart(codeDigits, '0')
      : rawCode.length > codeDigits
        ? rawCode.slice(-codeDigits)
        : rawCode;
    const codeWidth = Math.max(24, codeDigits * 8);

    return (
      <div className="flex items-center gap-2 overflow-hidden">
        {!isVirtualRoot && (
          <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: `${codeWidth}px` }}>
            <Hash className="w-3 h-3 text-slate-400" />
            <span className={cn("tabular-nums text-xs font-medium", isSummary ? "text-slate-600" : "text-slate-500")}>
              {displayCode}
            </span>
          </div>
        )}
        <span className={cn("truncate", isVirtualRoot && "text-primary font-bold")}>
          {node.name_ar}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {node.is_default && (
            <span className="inline-flex p-0.5 rounded-full bg-blue-50">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            </span>
          )}
          {!node.is_active && (
            <span className="inline-flex p-0.5 rounded-full bg-slate-100">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderRight = (node: AccountTreeNode) => {
    if (isVirtualRoot) return (
      <>
        <div className="w-[90px]" />
        <div className="w-[100px]" />
        <div className="w-[120px] text-left text-slate-400">—</div>
      </>
    );

    return (
      <>
        <div className="w-[90px]">
          {node.is_final ? (
            <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700">نهائي</span>
          ) : (
            <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-medium", isSummaryAccount(node) ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
              {isSummaryAccount(node) ? "تجميعي" : "فرعي"}
            </span>
          )}
        </div>
        <div className="w-[100px]">
          <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-medium border", TYPE_LABELS[node.account_type]?.color || "bg-slate-50 text-slate-600 border-slate-200")}>
            {TYPE_LABELS[node.account_type]?.label || node.account_type}
          </span>
        </div>
        <div className="w-[120px] text-left tabular-nums">
          <span className={cn("text-sm font-medium", parseAmount(node.balance) >= 0 ? "text-slate-700" : "text-red-600")}>
            {formatCurrency(parseAmount(node.balance))}
          </span>
        </div>
      </>
    );
  };

  return (
    <TreeItem
      node={account}
      level={level}
      selectedId={selectedId}
      onSelect={onSelect}
      expandedNodes={expandedNodes}
      onToggle={toggleNode}
      renderIcon={renderIcon}
      renderLabel={renderLabel}
      renderRight={renderRight}
      isVirtualRoot={isVirtualRoot}
    />
  );
}
