import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Search, RefreshCw, Users as UsersIcon, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import { formatDate } from "@/lib/format";
import { userService } from "@/services/userService";
import type { User, Role, CreateUserRequest, CreateRoleRequest } from "@erp/shared-types";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { useDataTable } from "@/hooks/useDataTable";
import { UserForm } from "@/components/erp/users/UserForm";
import { RoleTable } from "@/components/erp/users/RoleTable";
import { RoleForm } from "@/components/erp/users/RoleForm";

export default function Users() {
  const [activeTab, setActiveTab] = useState("users");
  
  const {
    filtered: users,
    loading: usersLoading,
    search,
    setSearch,
    refresh: refreshUsers,
  } = useDataTable<User>({
    fetchData: () => userService.listUsers(),
    searchFields: ["username", "full_name"],
    errorLabel: "فشل تحميل المستخدمين",
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
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

  const handleCreateUser = async (payload: CreateUserRequest) => {
    setSaving(true);
    try {
      await userService.createUser(payload);
      setShowUserDialog(false);
      refreshUsers(true);
      toast.success("تم إضافة المستخدم بنجاح");
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async (payload: CreateRoleRequest & { id?: string }) => {
    setSaving(true);
    try {
      if (payload.id) {
        await userService.updateRole(payload as Role);
        toast.success("تم تحديث الصلاحية بنجاح");
      } else {
        await userService.createRole(payload);
        toast.success("تم إضافة الصلاحية بنجاح");
      }
      setShowRoleDialog(false);
      loadRoles();
    } catch (e) {
      toast.error("فشل حفظ الصلاحية: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الصلاحية؟")) return;
    try {
      await userService.deleteRole(id);
      toast.success("تم حذف الصلاحية");
      loadRoles();
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  };

  const userColumns = useMemo<Column<User>[]>(() => [
    { 
      header: "الاسم الكامل", 
      accessor: "full_name", 
      className: "font-bold text-slate-800" 
    },
    { 
      header: "اسم المستخدم", 
      accessor: "username", 
      className: "text-slate-500 font-mono text-xs" 
    },
    { 
      header: "الصلاحية", 
      accessor: (u) => {
        const role = roles.find(r => r.id === u.role_id);
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {role?.name ?? u.role_name ?? "غير محدد"}
          </span>
        );
      }
    },
    { 
      header: "آخر ظهور", 
      accessor: (u) => u.last_login ? formatDate(u.last_login) : "—",
      className: "text-xs text-slate-400 tabular-nums"
    },
    { 
      header: "الحالة", 
      accessor: (u) => <StatusBadge status={u.is_active ? "active" : "inactive"} />, 
      align: "center",
      className: "w-[100px]"
    },
    {
      header: "إجراءات",
      accessor: (u) => (
        <TableActions 
          onEdit={() => toast.info("تعديل المستخدم قيد التطوير")}
          onDelete={() => toast.warning("حذف المستخدم قيد التطوير")}
        />
      ),
      align: "left",
      className: "w-16"
    }
  ], [roles]);

  const refreshAll = () => {
    refreshUsers(true);
    loadRoles();
  };

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة حسابات المستخدمين وصلاحيات الوصول للنظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإعدادات" }, { label: "المستخدمون" }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAll} disabled={usersLoading || loadingRoles}>
              <RefreshCw className={`w-4 h-4 ml-2 ${(usersLoading || loadingRoles) ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => {
              if (activeTab === "users") {
                setShowUserDialog(true);
              } else {
                setSelectedRole(null);
                setShowRoleDialog(true);
              }
            }}>
              <Plus className="w-4 h-4 ml-2" />
              {activeTab === "users" ? "مستخدم جديد" : "صلاحية جديدة"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatSummary label="إجمالي المستخدمين" value={users.length} icon={<UsersIcon />} />
        <StatSummary label="مستخدم نشط" value={activeCount} icon={<ShieldCheck />} color="text-green-600" />
        <StatSummary label="أدوار النظام" value={roles.length} icon={<Shield />} color="text-blue-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border p-1 h-12 rounded-xl shadow-sm">
          <TabsTrigger value="users" className="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
            <UsersIcon className="w-4 h-4" /> قائمة المستخدمين
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
            <Shield className="w-4 h-4" /> أدوار الوصول
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="بحث بالاسم أو اسم المستخدم..." 
                  className="pr-10 border-slate-200 focus:ring-primary/20"
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </div>

            <DataTable
              data={users}
              columns={userColumns}
              loading={usersLoading}
              emptyMessage={search ? "لا توجد نتائج للبحث" : "لا يوجد مستخدمين مضافين"}
            />
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100">
             <RoleTable 
               roles={roles}
               loading={loadingRoles}
               onEdit={(r) => { setSelectedRole(r); setShowRoleDialog(true); }}
               onDelete={handleDeleteRole}
             />
          </Card>
        </TabsContent>
      </Tabs>

      <UserForm
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        roles={roles}
        onSave={handleCreateUser}
        saving={saving}
      />

      <RoleForm 
        open={showRoleDialog}
        onOpenChange={setShowRoleDialog}
        role={selectedRole}
        onSave={handleSaveRole}
        saving={saving}
      />
    </>
  );
}

function StatSummary({ label, value, icon, color = "text-slate-900" }: { label: string, value: number, icon: React.ReactNode, color?: string }) {
  return (
    <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100">
      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1.5">
        <span className="p-1 bg-slate-50 rounded-md text-slate-400">{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </Card>
  );
}
