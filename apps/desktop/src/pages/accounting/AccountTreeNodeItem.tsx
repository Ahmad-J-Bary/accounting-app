import { ChevronDown, ChevronRight, FileText, FolderOpen, Folder, Lock, ShieldCheck, Hash } from "lucide-react";
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
  const isExpanded = expandedNodes.has(account.id);
  const hasChildren = account.children.length > 0;
  const isSelected = selectedId === account.id;
  const isVirtualRoot = virtualRootId === account.id;
  const isSummary = isVirtualRoot || isSummaryAccount(account);

  // Calculate code digits based on level: level 1 -> 1 digit, level 2 -> 2 digits, etc.
  const codeDigits = Math.max(1, account.level ?? 0);
  const rawCode = (account.code ?? "").toString();
  // Ensure display uses digit count equal to level
  const displayCode = rawCode.length < codeDigits
    ? rawCode.padStart(codeDigits, '0')
    : rawCode.length > codeDigits
      ? rawCode.slice(-codeDigits)
      : rawCode;
  // Small visual width hint based on digits
  const codeWidth = Math.max(24, codeDigits * 8);

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-2 py-2.5 px-3 cursor-pointer transition-all duration-150",
          "border-b border-slate-100 hover:bg-slate-50/80",
          isSelected && "bg-primary/5 border-l-2 border-l-primary hover:bg-primary/10",
          isSummary ? "font-semibold text-slate-800" : "text-sm text-slate-700",
        )}
        style={{ paddingRight: `${level * 16 + 12}px` }}
        onClick={() => onSelect(account)}
      >
        {/* Expand/Collapse Button */}
        <div className="flex items-center justify-center w-6">
          {hasChildren ? (
            <button
              onClick={(event) => toggleNode(account.id, event)}
              className={cn(
                "p-1 rounded-md transition-colors",
                "hover:bg-slate-200/70 text-slate-500 hover:text-slate-700",
                "focus:outline-none focus:ring-1 focus:ring-primary/30"
              )}
              type="button"
              aria-label={isExpanded ? "طي العقدة" : "توسيع العقدة"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
        </div>

        {/* Account Icon */}
        <div className="flex items-center justify-center w-5">
          {isVirtualRoot ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : account.is_final ? (
            <FileText className="w-4 h-4 text-emerald-500" />
          ) : isSummary ? (
            <Folder className="w-4 h-4 text-amber-500" />
          ) : (
            <FileText className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Account Code */}
        <div className="flex items-center gap-1.5" style={{ minWidth: `${codeWidth}px` }}>
          {!isVirtualRoot && (
            <>
              <Hash className="w-3 h-3 text-slate-400" />
              <span className={cn(
                "tabular-nums text-xs font-medium",
                isSummary ? "text-slate-600" : "text-slate-500"
              )}>
                {displayCode}
              </span>
            </>
          )}
        </div>

        {/* Account Name */}
        <span className={cn(
          "flex-1 truncate",
          isVirtualRoot && "text-primary font-bold"
        )}>
          {account.name_ar}
        </span>

        {/* Status Icons */}
        <div className="flex items-center gap-1">
          {account.is_default && (
            <span className="inline-flex p-0.5 rounded-full bg-blue-50" aria-label="حساب افتراضي">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            </span>
          )}
          {!account.is_active && (
            <span className="inline-flex p-0.5 rounded-full bg-slate-100" aria-label="حساب معطل">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            </span>
          )}
        </div>

        {/* Category Badge */}
        <div className="w-[90px]">
          {isVirtualRoot ? (
            <span className="text-xs text-slate-400">—</span>
          ) : account.is_final ? (
            <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700">
              نهائي
            </span>
          ) : (
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-medium",
              isSummary 
                ? "bg-amber-50 text-amber-700" 
                : "bg-slate-100 text-slate-600"
            )}>
              {isSummary ? "تجميعي" : "فرعي"}
            </span>
          )}
        </div>

        {/* Account Type Badge */}
        <div className="w-[100px]">
          {isVirtualRoot ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md font-medium border",
                TYPE_LABELS[account.account_type]?.color || "bg-slate-50 text-slate-600 border-slate-200",
              )}
            >
              {TYPE_LABELS[account.account_type]?.label || account.account_type}
            </span>
          )}
        </div>

        {/* Balance */}
        <div className="w-[120px] text-left tabular-nums">
          {isVirtualRoot ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className={cn(
              "text-sm font-medium",
              parseAmount(account.balance) >= 0 ? "text-slate-700" : "text-red-600"
            )}>
              {formatCurrency(parseAmount(account.balance))}
            </span>
          )}
        </div>
      </div>

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div className="bg-white/50">
          {account.children.map((child) => (
            <AccountTreeNodeItem
              key={child.id}
              account={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              virtualRootId={virtualRootId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
