import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Search, RefreshCw, Users as UsersIcon, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { userService } from "@/services/userService";
import type { User, Role, CreateUserRequest } from "@erp/shared-types";
import { toast } from "sonner";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { UserForm } from "@/components/erp/users/UserForm";

export default function Users() {
  const {
    filtered: users,
    loading: usersLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<User>({
    fetchData: () => userService.listUsers(),
    searchFields: ["username", "full_name"],
    errorLabel: "فشل تحميل المستخدمين",
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true);
      const rArgs = await userService.listRoles();
      setRoles(rArgs);
    } catch (e) {
      toast.error("فشل تحميل الصلاحيات");
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const activeCount = useMemo(() => users.filter(u => u.is_active).length, [users]);
  const adminCount = useMemo(() => users.filter(u => roles.find(r => r.id === u.role_id)?.permissions.includes("Admin")).length, [users, roles]);

  const handleCreate = async (payload: CreateUserRequest) => {
    setSaving(true);
    try {
      await userService.createUser(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم إضافة المستخدم بنجاح");
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<Column<User>[]>(() => [
    { header: "الاسم الكامل", accessor: "full_name", className: "font-medium" },
    { header: "اسم المستخدم", accessor: "username", className: "text-muted-foreground" },
    { 
      header: "الصلاحية", 
      accessor: (u) => {
        const role = roles.find(r => r.id === u.role_id);
        return (
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {role?.name ?? u.role_name ?? "غير محدد"}
          </span>
        );
      }
    },
    { 
      header: "آخر دخول", 
      accessor: (u) => u.last_login ? formatDate(u.last_login) : "لم يسجل دخول",
      className: "text-xs text-muted-foreground tabular-nums"
    },
    { 
      header: "الحالة", 
      accessor: (u) => <StatusBadge status={u.is_active ? "active" : "inactive"} />, 
      align: "left" 
    }
  ], [roles]);

  const isLoading = usersLoading || loadingRoles;

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة حسابات المستخدمين وصلاحيات الوصول للنظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإعدادات" }, { label: "المستخدمون" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />مستخدم جديد
            </Button>
          </>
        }
      />

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

        <DataTable
          data={users}
          columns={columns}
          loading={isLoading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا يوجد مستخدمين مضافين"}
        />
      </Card>

      <UserForm
        open={showDialog}
        onOpenChange={setShowDialog}
        roles={roles}
        onSave={handleCreate}
        saving={saving}
      />
    </>
  );
}
