import { X, Pencil, Trash2, BookOpen, FileText } from "lucide-react";
import { DetailPanel, ActionButton } from "@widgets/sidebar";
import { SidebarSection } from "@widgets/sidebar/SidebarSection";
import { FieldLabel } from "@widgets/sidebar/FieldLabel";
import { Input } from "@shared/ui/input";
import type { PartnerDto, CustomerDto, SupplierDto } from "@erp/shared-types";
import { useTabs } from "@app/providers/TabContext";

interface PartnerDetailPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto;
  onClose: () => void;
  onEdit: (partner: CustomerDto | SupplierDto | PartnerDto) => void;
  onDelete: (id: string, name: string) => void;
}

export function PartnerDetailPanel({
  type,
  partner,
  onClose,
  onEdit,
  onDelete,
}: PartnerDetailPanelProps) {
  const { openTab } = useTabs();

  if (!partner) return null;

  const isCustomer = type === "customer";
  const isPartner = "amount_original" in partner;
  const hasAccountId = (p: typeof partner): p is CustomerDto | SupplierDto => "account_id" in p;
  const partnerAccountId = hasAccountId(partner) ? partner.account_id : null;
  const isDisabled = true;

  const actions = (
    <>
      <ActionButton icon={<Pencil className="w-3.5 h-3.5" />} label="تعديل" color="amber" onClick={() => onEdit(partner)} />
      <ActionButton icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" color="red" onClick={() => { if (confirm(`هل أنت متأكد من حذف "${partner.name}"؟`)) onDelete(partner.id, partner.name); }} />
      {!isPartner && partnerAccountId && (
        <>
          <ActionButton icon={<BookOpen className="w-3.5 h-3.5" />} label="اليومية" color="blue" onClick={() => openTab({
            id: `ledger-${partnerAccountId}`,
            title: `حركة: ${partner.name}`,
            path: `/accounting/account-ledger/${partnerAccountId}`,
            closable: true,
          })} />
          <ActionButton icon={<FileText className="w-3.5 h-3.5" />} label="الكشف" color="emerald" onClick={() => openTab({
            id: `statement-${partner.id}`,
            title: `كشف: ${partner.name}`,
            path: `/partners/customer-statement/${partner.id}`,
            closable: true,
          })} />
        </>
      )}
    </>
  );

  if (isPartner) {
    return (
      <DetailPanel
        title="بيانات الشريك"
        actions={actions}
        onClose={onClose}
      >
        <SidebarSection title="المعلومات الأساسية">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>رقم الحساب</FieldLabel>
              <Input value={partner.code || ""} disabled className="h-9 bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>الاسم</FieldLabel>
              <Input value={partner.name} disabled className="h-9 bg-slate-50" />
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title="معلومات الاستثمار">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>المبلغ (الأصلي)</FieldLabel>
              <Input value={partner.amount_original || "0"} disabled className="h-9 bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>المبلغ (محلي)</FieldLabel>
              <Input value={partner.amount_local || "0"} disabled className="h-9 bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>نسبة الأرباح (%)</FieldLabel>
              <Input value={partner.profit_sharing_ratio || ""} disabled className="h-9 bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>طريقة التوزيع</FieldLabel>
              <Input value={partner.profit_sharing_type || ""} disabled className="h-9 bg-slate-50" />
            </div>
          </div>
        </SidebarSection>

        {partner.notes && (
          <div className="space-y-1.5">
            <FieldLabel>ملاحظات</FieldLabel>
            <Input value={partner.notes || ""} disabled className="h-9 bg-slate-50" />
          </div>
        )}
      </DetailPanel>
    );
  }

  return (
    <DetailPanel
      title={isCustomer ? "بيانات العميل" : "بيانات المورد"}
      actions={actions}
      onClose={onClose}
    >
      <SidebarSection title="المعلومات الأساسية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>رقم الحساب</FieldLabel>
            <Input value={partner.code || ""} disabled className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>{isCustomer ? "اسم العميل" : "اسم المورد"}</FieldLabel>
            <Input value={partner.name} disabled className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>رقم الهاتف</FieldLabel>
            <Input value={partner.phone || ""} disabled placeholder="—" className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>العنوان</FieldLabel>
            <Input value={partner.address || ""} disabled placeholder="—" className="h-9 bg-slate-50" />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="البيانات المالية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>الرصيد الافتتاحي</FieldLabel>
            <Input value={partner.opening_balance || "0"} disabled className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>العملة</FieldLabel>
            <Input value={partner.currency || ""} disabled className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>مدين (حالي)</FieldLabel>
            <Input value={partner.debit || "0"} disabled className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>دائن (حالي)</FieldLabel>
            <Input value={partner.credit || "0"} disabled className="h-9 bg-slate-50" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <FieldLabel>الرصيد الحالي</FieldLabel>
            <Input value={partner.balance || "0"} disabled className="h-9 bg-slate-50 font-bold" />
          </div>
        </div>
      </SidebarSection>

      {partner.notes && (
        <div className="space-y-1.5">
          <FieldLabel>ملاحظات</FieldLabel>
          <Input value={partner.notes || ""} disabled className="h-9 bg-slate-50" />
        </div>
      )}
    </DetailPanel>
  );
}
