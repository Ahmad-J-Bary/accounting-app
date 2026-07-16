import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@shared/ui/dialog";
import { Checkbox } from "@shared/ui/checkbox";
import type { Role, CreateRoleRequest } from "@erp/shared-types";

interface RoleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
  onSave: (payload: CreateRoleRequest & { id?: string }) => Promise<void>;
  saving: boolean;
}

const AVAILABLE_PERMISSIONS = [
  { id: "Admin", label: "مدير نظام كامل" },
  { id: "Accounting", label: "المحاسبة والقيود" },
  { id: "Inventory", label: "إدارة المخازن" },
  { id: "Purchases", label: "المشتريات والموردين" },
  { id: "Sales", label: "المبيعات والعملاء" },
  { id: "Reports", label: "عرض التقارير" },
  { id: "Settings", label: "الإعدادات العامة" },
];

export function RoleForm({ open, onOpenChange, role, onSave, saving }: RoleFormProps) {
  const [form, setForm] = useState<CreateRoleRequest>({
    name: role?.name || "",
    description: role?.description || "",
    permissions: role?.permissions || [],
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        name: role?.name || "",
        description: role?.description || "",
        permissions: role?.permissions || [],
      });
    }
    onOpenChange(isOpen);
  };

  const handleTogglePermission = (perm: string) => {
    setForm(prev => {
      const perms = prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: perms };
    });
  };

  const handleSave = async () => {
    if (!form.name || form.permissions.length === 0) return;
    await onSave({ ...form, id: role?.id });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{role ? "تعديل صلاحية" : "إضافة صلاحية جديدة"}</DialogTitle>
          <DialogDescription>تحديد اسم الصلاحية واختيار الأذونات المرتبطة بها.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>اسم الدور/الصلاحية *</Label>
            <Input 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="مثال: محاسب، أمين مستودع..." 
              disabled={role?.is_system_role}
            />
          </div>
          <div className="space-y-1">
            <Label>الوصف</Label>
            <Input 
              value={form.description} 
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              placeholder="وصف مختصر للمهام..." 
            />
          </div>
          
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-bold">الأذونات المتاحة *</Label>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {AVAILABLE_PERMISSIONS.map(p => (
                <div key={p.id} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox 
                    id={p.id} 
                    checked={form.permissions.includes(p.id)}
                    onCheckedChange={() => handleTogglePermission(p.id)}
                  />
                  <label htmlFor={p.id} className="text-xs cursor-pointer select-none">{p.label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || form.permissions.length === 0}>
            {saving ? "جاري الحفظ..." : "حفظ الدور"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
