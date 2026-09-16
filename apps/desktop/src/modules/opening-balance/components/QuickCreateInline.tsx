import { useState } from "react";
import { Plus, Loader2, X, Check } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface QuickCreateInlineProps {
  label: string;
  placeholder: string;
  amountLabel: string;
  direction?: "debit" | "credit";
  onCreate: (name: string, amount: string) => Promise<boolean>;
  navLink?: React.ReactNode;
}

export function QuickCreateInline({ label, placeholder, amountLabel, direction, onCreate, navLink }: QuickCreateInlineProps) {
  const { t } = useLocalization();
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
          className="h-8 shrink-0 rounded-full border-success/20 bg-success/10 px-3 text-xs font-bold text-success hover:bg-success/20 hover:border-success/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5 ms-1" />
          {t("quickCreate.addLabel", { namespace: "openingBalance", vars: { label } })}
        </Button>
        {navLink}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="h-8 flex-1 border-border text-xs bg-card"
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
          className="h-8 w-32 border-border text-xs text-end tabular-nums bg-card"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        {direction && (
          <span className="text-2xs font-semibold text-muted-foreground shrink-0">
            {direction === "debit" ? t("quickCreate.debit", { namespace: "openingBalance" }) : t("quickCreate.credit", { namespace: "openingBalance" })}
          </span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCreate()}
            disabled={creating || !name.trim() || !amount.trim()}
            className="h-8 px-2 text-xs font-bold bg-success hover:bg-success/80 text-white shrink-0"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {t("quickCreate.save", { namespace: "openingBalance" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={cancel}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-muted-foreground shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {navLink && <div className="px-3 pb-1">{navLink}</div>}
    </>
  );
}
