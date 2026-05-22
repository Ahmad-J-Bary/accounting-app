import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { X, Pencil, Trash2, BookOpen, FileText } from "lucide-react";
import type { InvoiceDto, Payment, CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";

interface PartnerDetailPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto;
  onClose: () => void;
  onEdit: (partner: CustomerDto | SupplierDto | PartnerDto) => void;
  onDelete: (id: string, name: string) => void;
  invoices: InvoiceDto[];
  payments: Payment[];
  loadingDetails: boolean;
}

export function PartnerDetailPanel({
  type,
  partner,
  onClose,
  onEdit,
  onDelete
}: PartnerDetailPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();
  
  if (!partner) return null;

  const isCustomer = type === "customer";
  const isPartner = "amount_usd" in partner;
  const hasAccountId = (p: typeof partner): p is CustomerDto | SupplierDto => "account_id" in p;
  const partnerAccountId = hasAccountId(partner) ? partner.account_id : null;
  const isDisabled = true;

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
          <h2 className="text-lg font-bold text-slate-800">
            {isPartner ? "بيانات الشريك" : (isCustomer ? "بيانات العميل" : "بيانات المورد")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-amber-500 text-white hover:bg-amber-600 border-none h-8 px-3 rounded-lg"
            onClick={() => onEdit(partner)}
          >
            <Pencil className="w-3.5 h-3.5 ml-1.5" />
            تعديل
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-red-500 text-white hover:bg-red-600 border-none h-8 px-3 rounded-lg"
            onClick={() => {
              if (confirm(`هل أنت متأكد من حذف "${partner.name}"؟`)) {
                onDelete(partner.id, partner.name);
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5 ml-1.5" />
            حذف
          </Button>
          {!isPartner && partnerAccountId && (
            <div className="flex flex-col gap-1.5">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-blue-600 text-white hover:bg-blue-700 border-none h-8 px-3 rounded-lg w-full"
                onClick={() => openTab({
                  id: `ledger-${partnerAccountId}`,
                  title: `حركة: ${partner.name}`,
                  path: `/accounting/account-ledger/${partnerAccountId}`,
                  closable: true
                })}
              >
                <BookOpen className="w-3.5 h-3.5 ml-1.5" />
                اليومية
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-emerald-600 text-white hover:bg-emerald-700 border-none h-8 px-3 rounded-lg w-full"
                onClick={() => openTab({
                  id: `statement-${partner.id}`,
                  title: `كشف: ${partner.name}`,
                  path: `/partners/customer-statement/${partner.id}`,
                  closable: true
                })}
              >
                <FileText className="w-3.5 h-3.5 ml-1.5" />
                الكشف
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isPartner ? (
          <div className="space-y-6 text-right">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">المعلومات الأساسية</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">رقم الحساب</Label>
                  <Input value={partner.code || ""} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">الاسم</Label>
                  <Input value={partner.name} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">معلومات الاستثمار</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">المبلغ ({baseCurrency?.symbol || baseCurrency?.code || "$"})</Label>
                  <Input value={partner.amount_usd || "0"} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">المبلغ (محلي)</Label>
                  <Input value={partner.amount_local || "0"} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">نسبة الأرباح (%)</Label>
                  <Input value={partner.profit_sharing_ratio || ""} disabled={isDisabled} placeholder="تلقائي" className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">طريقة التوزيع</Label>
                  <Select value={partner.profit_sharing_type || "BasedOnCapitalLocal"} disabled={isDisabled}>
                    <SelectTrigger className="h-9 font-bold bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BasedOnCapitalLocal">على أساس رأس المال المحلي</SelectItem>
                      <SelectItem value="BasedOnCapitalUSD">على أساس رأس المال دولار</SelectItem>
                      <SelectItem value="Manual">يدوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {partner.notes && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">ملاحظات</Label>
                <Input value={partner.notes || ""} disabled={isDisabled} className="h-9 bg-slate-50" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 text-right">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">المعلومات الأساسية</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">رقم الحساب</Label>
                  <Input value={partner.code || ""} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">{isCustomer ? "اسم العميل" : "اسم المورد"}</Label>
                  <Input value={partner.name} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">رقم الهاتف</Label>
                  <Input value={partner.phone || ""} disabled={isDisabled} placeholder="—" className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">العنوان</Label>
                  <Input value={partner.address || ""} disabled={isDisabled} placeholder="—" className="h-9 bg-slate-50" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">البيانات المالية</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">الرصيد الافتتاحي</Label>
                  <Input value={partner.opening_balance || "0"} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">العملة</Label>
                  <Select value={partner.currency || baseCurrency?.code || ""} disabled={isDisabled}>
                    <SelectTrigger className="h-9 font-bold bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">مدين (حالي)</Label>
                  <Input value={partner.debit || "0"} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">دائن (حالي)</Label>
                  <Input value={partner.credit || "0"} disabled={isDisabled} className="h-9 bg-slate-50" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-bold text-slate-600">الرصيد الحالي</Label>
                  <Input value={partner.balance || "0"} disabled={isDisabled} className="h-9 bg-slate-50 font-bold" />
                </div>
              </div>
            </div>

            {partner.notes && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">ملاحظات</Label>
                <Input value={partner.notes || ""} disabled={isDisabled} className="h-9 bg-slate-50" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}