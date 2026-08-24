import { useState } from "react";
import { Plus, Loader2, X, Check } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";

interface QuickCreatePartnerProps {
  onCreate: (data: {
    name: string;
    amount: string;
  }) => Promise<boolean>;
  navLink?: React.ReactNode;
}

export function QuickCreatePartner({ onCreate, navLink }: QuickCreatePartnerProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !amount.trim()) return;
    setCreating(true);
    try {
      const ok = await onCreate({ name: name.trim(), amount: amount.trim() });
      if (ok) {
        setName("");
        setAmount("");
        setExpanded(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const cancel = () => {
    setExpanded(false);
    setName("");
    setAmount("");
  };

  if (!expanded) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(true)}
          className="h-8 shrink-0 rounded-full border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
        >
          <Plus className="w-3.5 h-3.5 ml-1" />
          إضافة شريك
        </Button>
        {navLink}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <Badge variant="outline" className="text-2xs bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">جديد</Badge>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الشريك"
          className="h-8 flex-1 border-slate-200 text-xs bg-white"
          disabled={creating}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              document.getElementById("quick-create-partner-amount")?.focus();
            }
          }}
        />
        <Input
          id="quick-create-partner-amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="رأس المال"
          className="h-8 w-32 border-slate-200 text-xs text-right tabular-nums bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <span className="text-2xs font-semibold text-slate-400 shrink-0">دائن</span>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !amount.trim()}
          className="h-8 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          حفظ
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={cancel}
          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      {navLink && <div className="px-3 pb-1">{navLink}</div>}
    </>
  );
}
