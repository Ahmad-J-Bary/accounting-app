import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Search, RefreshCw, Users as UsersIcon, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { userService } from "@/services/userService";
import type { User, Role, CreateUserRequest } from "@erp/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<Partial<CreateUserRequest>>({
    username: "",
    full_name: "",
    password: "",
    role_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [uArgs, rArgs] = await Promise.all([userService.listUsers(), userService.listRoles()]);
      setUsers(uArgs);
      setRoles(rArgs);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.username.includes(search) || u.full_name.includes(search)
  );

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => roles.find(r => r.id === u.role_id)?.permissions.includes("Admin")).length;

  const handleCreate = async () => {
    if (!form.username || !form.full_name || !form.password || !form.role_id) return;
    setSaving(true);
    try {
      await userService.createUser(form as CreateUserRequest);
      setShowDialog(false);
      setForm({ username: "", full_name: "", password: "", role_id: "" });
      await load();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة حسابات المستخدمين وصلاحيات الوصول للنظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإعدادات" }, { label: "المستخدمون" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />مستخدم جديد
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error} <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <UsersIcon className="w-4 h-4" /> إجمالي المستخدمين
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{users.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-green-500" /> مستخدم نشط
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{activeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 text-red-500" /> مدراء النظام
          </div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{adminCount}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو اسم المستخدم..." className="pr-10"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا يوجد مستخدمين مضافين</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">الاسم الكامل</th>
                  <th className="text-right px-4 py-3 font-medium">اسم المستخدم</th>
                  <th className="text-right px-4 py-3 font-medium">الصلاحية</th>
                  <th className="text-right px-4 py-3 font-medium">آخر دخول</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const role = roles.find(r => r.id === u.role_id);
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{u.full_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {role?.name ?? u.role_name ?? "غير محدد"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{u.last_login ? formatDate(u.last_login) : "لم يسجل دخول"}</td>
                      <td className="px-4 py-3 text-left">
                        <StatusBadge status={u.is_active ? "active" : "inactive"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving || !form.username || !form.full_name || !form.password || !form.role_id}>
              {saving ? "جاري الحفظ..." : "حفظ المستخدم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
