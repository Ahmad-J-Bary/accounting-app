import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from '@widgets/page-header/PageHeader';
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { Plus, Users as UsersIcon, ShieldCheck, Shield, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { userService } from '@modules/core/api/userService';
import type { User, Role, CreateUserRequest, CreateRoleRequest } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { UserForm } from '@modules/core/components/UserForm';
import { RoleTable } from '@modules/core/components/RoleTable';
import { RoleForm } from '@modules/core/components/RoleForm';

export default function UsersPage() {
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

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const activeCount = useMemo(() => users.filter(u => u.is_active).length, [users]);

  const userColumns = useMemo<UnifiedColumn<User>[]>(() => [
    { 
      id: "full_name",
      header: "الاسم الكامل", 
      label: "الاسم الكامل", 
      accessor: "full_name", 
      className: "font-bold text-slate-800 min-w-[180px]" 
    },
    { 
      id: "username",
      header: "اسم المستخدم", 
      label: "اسم المستخدم", 
      accessor: "username", 
      className: "text-slate-500 font-mono text-xs w-32" 
    },
    { 
      id: "role",
      header: "الصلاحية", 
      label: "الدور/الصلاحية", 
      accessor: (u) => {
        const role = roles.find(r => r.id === u.role_id);
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {role?.name ?? u.role_name ?? "غير محدد"}
          </span>
        );
      },
      className: "w-32"
    },
    { 
      id: "last_login",
      header: "آخر ظهور", 
      label: "تاريخ آخر دخول", 
      accessor: (u) => u.last_login ? formatDateTime(u.last_login) : "—",
      className: "text-xs text-slate-400 tabular-nums w-44"
    },
    { 
      id: "status",
      header: "الحالة", 
      label: "حالة الحساب", 
      accessor: (u) => <StatusBadge status={u.is_active ? "active" : "inactive"} />, 
      align: "center",
      className: "w-28"
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => toast.info("تعديل المستخدم قيد التطوير")} className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600">
              <Edit className="w-4 h-4" /> تعديل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.warning("حذف المستخدم قيد التطوير")} className="flex-row-reverse gap-2 text-rose-600 focus:text-rose-600">
              <Trash2 className="w-4 h-4" /> حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    }
  ], [roles]);

  const { visibleColumns: userVisible, toggleColumn: toggleUserCol } = useColumnPreferences("users-unified", userColumns.map(c => c.id));

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

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة حسابات المستخدمين وصلاحيات الوصول للنظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإعدادات" }, { label: "المستخدمون" }]}
        actions={
          <Button onClick={() => {
            if (activeTab === "users") {
              setShowUserDialog(true);
            } else {
              setSelectedRole(null);
              setShowRoleDialog(true);
            }
          }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
            <Plus className="w-4 h-4 ml-2" />
            {activeTab === "users" ? "مستخدم جديد" : "صلاحية جديدة"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatSummary label="إجمالي المستخدمين" value={users.length} icon={<UsersIcon />} />
        <StatSummary label="مستخدم نشط" value={activeCount} icon={<ShieldCheck />} color="text-emerald-600" />
        <StatSummary label="أدوار النظام" value={roles.length} icon={<Shield />} color="text-blue-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 h-12 rounded-xl shadow-sm">
          <TabsTrigger value="users" className="rounded-lg px-6 gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <UsersIcon className="w-4 h-4" /> قائمة المستخدمين
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <Shield className="w-4 h-4" /> أدوار الوصول
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <TableShell
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="بحث بالاسم أو اسم المستخدم..."
            columns={userColumns.map(c => ({
              id: c.id,
              label: c.label || (typeof c.header === 'string' ? c.header : c.id),
              visible: userVisible.includes(c.id)
            }))}
            onColumnToggle={toggleUserCol}
          >
            <UnifiedTable
              data={users}
              columns={userColumns.map(col => ({
                ...col,
                visible: userVisible.includes(col.id)
              }))}
              loading={usersLoading}
              emptyMessage={search ? "لا توجد نتائج للبحث" : "لا يوجد مستخدمين مضافين"}
            />
          </TableShell>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="p-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
    </div>
  );
}

function StatSummary({ label, value, icon, color = "text-slate-900" }: { label: string, value: number, icon: React.ReactNode, color?: string }) {
  return (
    <Card className="p-4 border border-slate-100 shadow-sm flex items-center gap-4">
      <div className={cn("p-3 rounded-xl bg-slate-50", color.replace("text-", "bg-").replace("600", "50"))}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={cn("text-2xl font-black tabular-nums", color)}>{value}</p>
      </div>
    </Card>
  );
}
