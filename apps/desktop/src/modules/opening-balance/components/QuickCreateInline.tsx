import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";

interface QuickCreateInlineProps {
  label: string;
  placeholder: string;
  amountLabel: string;
  direction?: "debit" | "credit";
  onCreate: (name: string, amount: string) => Promise<boolean>;
}

export function QuickCreateInline({ label, placeholder, amountLabel, direction, onCreate }: QuickCreateInlineProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !amount.trim()) return;
    setCreating(true);
    try {
      const ok = await onCreate(name.trim(), amount.trim());
      if (ok) {
        setName("");
        setAmount("");
        setExpanded(false);
      }
    } finally {
      setCreating(false);
    }
  };

  if (!expanded) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(true)}
          className="h-8 shrink-0 rounded-full border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
        >
          <Plus className="w-3.5 h-3.5 ml-1" />
          إضافة {label}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
      <div className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold text-emerald-700 shrink-0">{label}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="h-7 flex-1 border-emerald-200 text-xs bg-white"
          disabled={creating}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              document.getElementById(`quick-create-amount-${label}`)?.focus();
            }
          }}
        />
        <Input
          id={`quick-create-amount-${label}`}
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={amountLabel}
          className="h-7 min-w-[140px] flex-1 border-emerald-200 text-xs text-right tabular-nums bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        {direction && (
          <span className="text-2xs font-semibold text-slate-400 shrink-0">
            {direction === "debit" ? "مدين" : "دائن"}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !amount.trim()}
          className="h-7 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { setExpanded(false); setName(""); setAmount(""); }}
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
