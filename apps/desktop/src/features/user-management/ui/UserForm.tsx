import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreateUserRequest, Role } from "@erp/shared-types";

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onSave: (payload: CreateUserRequest) => Promise<void>;
  saving: boolean;
}

export function UserForm({ open, onOpenChange, roles, onSave, saving }: UserFormProps) {
  const [form, setForm] = useState<Partial<CreateUserRequest>>({
    username: "",
    full_name: "",
    password: "",
    role_id: "",
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({ username: "", full_name: "", password: "", role_id: "" });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!form.username || !form.full_name || !form.password || !form.role_id) return;
    await onSave(form as CreateUserRequest);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          <DialogDescription>أدخل بيانات الحساب الجديد وتعيين الصلاحيات له.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>الاسم الكامل *</Label>
            <Input value={form.full_name ?? ""} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="أحمد محمد" />
          </div>
          <div className="space-y-1">
            <Label>اسم المستخدم للولوج *</Label>
            <Input value={form.username ?? ""} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="ahmad_m" />
          </div>
          <div className="space-y-1">
            <Label>كلمة المرور *</Label>
            <Input type="password" value={form.password ?? ""} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>دور النظام (الصلاحية) *</Label>
            <Select value={form.role_id} onValueChange={v => setForm(p => ({ ...p, role_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || !form.username || !form.full_name || !form.password || !form.role_id}>
            {saving ? "جاري الحفظ..." : "حفظ المستخدم"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
