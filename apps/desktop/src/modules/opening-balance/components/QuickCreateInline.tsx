import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";

interface QuickCreateInlineProps {
  label: string;
  placeholder: string;
  amountLabel: string;
  onCreate: (name: string, amount: string) => Promise<boolean>;
}

/**
 * Inline quick-create: name + amount + create button.
 * Used in opening-balance wizard stages to create entities (customer/supplier)
 * and assign an opening amount in one step.
 */
export function QuickCreateInline({ label, placeholder, amountLabel, onCreate }: QuickCreateInlineProps) {
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
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-1">
        <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold text-emerald-700 shrink-0">{label}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="h-7 w-32 border-emerald-200 text-xs bg-white"
          disabled={creating}
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
          className="h-7 w-24 border-emerald-200 text-xs text-right tabular-nums bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !amount.trim()}
          className="h-7 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}
