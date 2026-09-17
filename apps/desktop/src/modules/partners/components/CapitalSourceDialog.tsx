import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { accountingService } from '@modules/accounting/api/accountingService';
import { Wallet, Landmark, Package, HandCoins } from 'lucide-react';
import type { AccountDto } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolveAccountName } from "@shared/lib/system-labels";

export type CapitalSource = 'Cash' | 'Bank' | 'InKind' | 'Owed';

interface CapitalSourceDialogProps {
  open: boolean;
  partnerId: string | null;
  amount: string;
  isAmountInOriginal: boolean;
  onClose: () => void;
  onConfirm: (source: CapitalSource, fundingAccountId: string) => Promise<void>;
  submitting?: boolean;
}

const SOURCE_OPTIONS: { id: CapitalSource; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'Cash', icon: Wallet },
  { id: 'Bank', icon: Landmark },
  { id: 'InKind', icon: Package },
  { id: 'Owed', icon: HandCoins },
];

function accountCandidates(accounts: AccountDto[], source: CapitalSource): AccountDto[] {
  const detail = accounts.filter((a) => a.account_type === 'Assets' && a.category === 'Detail' && a.is_active);
  const match = (a: AccountDto) => `${a.name_ar} ${a.name_en} ${a.code}`.toLowerCase();
  const byPurpose = (a: AccountDto, ...purposes: string[]) => !!a.purpose && purposes.includes(a.purpose);
  switch (source) {
    case 'Cash': {
      const cashByPurpose = detail.find((a) => byPurpose(a, 'general') && (match(a).includes('نقد') || match(a).includes('صندوق') || a.code === '122'));
      const cash = cashByPurpose || detail.find((a) => match(a).includes('نقد') || match(a).includes('صندوق') || a.code === '122');
      return cash ? [cash] : detail;
    }
    case 'Bank':
      return detail.filter((a) => match(a).includes('بنك') || match(a).includes('مصرف'));
    case 'InKind':
      return detail.filter((a) => byPurpose(a, 'fixed_asset', 'inventory') || match(a).includes('أصل') || match(a).includes('عيني') || match(a).includes('آليات') || match(a).includes('سيارات') || match(a).includes('معدات') || match(a).includes('مخزون'));
    case 'Owed':
      return detail.filter((a) => byPurpose(a, 'receivable') || match(a).includes('ذمة') || match(a).includes('مستحق') || match(a).includes('عميل') || match(a).includes('قبض') || match(a).includes('مدين'));
    default:
      return detail;
  }
}

export function CapitalSourceDialog({
  open,
  partnerId,
  amount,
  onClose,
  onConfirm,
  submitting,
}: CapitalSourceDialogProps) {
  const { t, language } = useLocalization();
  const [source, setSource] = useState<CapitalSource>('Cash');
  const [fundingAccountId, setFundingAccountId] = useState('');
  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  useEffect(() => {
    if (!open) return;
    setSource('Cash');
    setFundingAccountId('');
    accountingService
      .getChartOfAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [open]);

  const candidates = useMemo(
    () => (open ? accountCandidates(accounts, source) : []),
    [accounts, source, open],
  );

  useEffect(() => {
    if (candidates.length && !candidates.some((a) => a.id === fundingAccountId)) {
      setFundingAccountId(candidates[0].id);
    }
  }, [candidates, fundingAccountId]);

  const canSubmit = !!partnerId && !!fundingAccountId;

  const sourceLabels: Record<CapitalSource, { label: string; hint: string }> = {
    Cash: {
      label: t("capitalSource.options.cashLabel", { namespace: "partners",  }),
      hint: t("capitalSource.options.cashHint", { namespace: "partners",  }),
    },
    Bank: {
      label: t("capitalSource.options.bankLabel", { namespace: "partners",  }),
      hint: t("capitalSource.options.bankHint", { namespace: "partners",  }),
    },
    InKind: {
      label: t("capitalSource.options.inKindLabel", { namespace: "partners",  }),
      hint: t("capitalSource.options.inKindHint", { namespace: "partners",  }),
    },
    Owed: {
      label: t("capitalSource.options.owedLabel", { namespace: "partners",  }),
      hint: t("capitalSource.options.owedHint", { namespace: "partners",  }),
    },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("capitalSource.title", { namespace: "partners",  })}</DialogTitle>
          <DialogDescription>
            {t("capitalSource.description", { namespace: "partners", vars: { amount: amount || '0' },  })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSource(opt.id)}
                className={
                  'text-right rounded-xl border p-3 flex items-start gap-2 transition ' +
                  (source === opt.id
                    ? 'border-primary bg-primary/10'
                    : 'border-muted bg-white hover:bg-muted/50')
                }
              >
                <opt.icon className={'w-4 h-4 mt-0.5 ' + (source === opt.id ? 'text-primary' : 'text-muted-foreground')} />
                <span className="space-y-0.5">
                  <span className="block text-xs font-bold text-foreground">{sourceLabels[opt.id].label}</span>
                  <span className="block text-[10px] leading-tight text-muted-foreground">{sourceLabels[opt.id].hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">{t("capitalSource.fundingAccount", { namespace: "partners",  })}</Label>
            {candidates.length === 0 ? (
              <p className="text-[11px] text-amber-600">{t("capitalSource.noAccounts", { namespace: "partners",  })}</p>
            ) : (
              <Select value={fundingAccountId} onValueChange={setFundingAccountId}>
                <SelectTrigger className="h-9 bg-white border-muted text-xs">
                  <SelectValue placeholder={t("capitalSource.selectPlaceholder", { namespace: "partners",  })} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.code} — {resolveAccountName(a, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>{t("actions.cancel", { namespace: "partners",  })}</Button>
          <Button
            onClick={() => onConfirm(source, fundingAccountId)}
            disabled={!canSubmit || submitting}
            className="bg-primary hover:bg-primary/80 text-white font-bold"
          >
            {submitting ? t("capitalSource.submitting", { namespace: "partners",  }) : t("capitalSource.confirm", { namespace: "partners",  })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
