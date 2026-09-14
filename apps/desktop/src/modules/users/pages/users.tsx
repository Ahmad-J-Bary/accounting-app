import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from '@widgets/page-header/PageHeader';
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { Plus, Users as UsersIcon, ShieldCheck, Shield } from "lucide-react";
import { userService } from '@modules/users/api/userService';
import type { User, Role, CreateUserRequest, CreateRoleRequest } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";

import { useDataTable } from '@shared/hooks';
import { useLocalization } from '@app/providers/LocalizationProvider';
import { UsersTable } from '@modules/users/components/UsersTable';
import { UserForm } from '@modules/users/components/UserForm';
import { RoleTable } from '@modules/users/components/RoleTable';
import { RoleForm } from '@modules/users/components/RoleForm';

export default function UsersPage() {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState("users");
  
  const {
    filtered: users,
    loading: usersLoading,
    search,
    setSearch,
    refresh: refreshUsers,
  } = useDataTable<User>({
    queryKey: ["users"],
    fetchData: () => userService.listUsers(),
    searchFields: ["username", "full_name"],
    errorLabel: t("errors.loadUsersFailed", { namespace: "users",  }),
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
    } catch (_e) {
      toast.error(t("toasts.rolesLoadFailed", { namespace: "users",  }));
    } finally {
      setLoadingRoles(false);
    }
  }, [t]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const activeCount = useMemo(() => users.filter(u => u.is_active).length, [users]);

  const handleCreateUser = async (payload: CreateUserRequest) => {
    setSaving(true);
    try {
      await userService.createUser(payload);
      setShowUserDialog(false);
      refreshUsers(true);
      toast.success(t("toasts.userAdded", { namespace: "users",  }));
    } catch (e) {
      toast.error(t("toasts.saveFailed", { namespace: "users",  }) + e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async (payload: CreateRoleRequest & { id?: string }) => {
    setSaving(true);
    try {
      if (payload.id) {
        await userService.updateRole(payload as Role);
        toast.success(t("toasts.roleUpdated", { namespace: "users",  }));
      } else {
        await userService.createRole(payload);
        toast.success(t("toasts.roleAdded", { namespace: "users",  }));
      }
      setShowRoleDialog(false);
      loadRoles();
    } catch (e) {
      toast.error(t("toasts.roleSaveFailed", { namespace: "users",  }) + e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm(t("confirmDeleteRole", { namespace: "users",  }))) return;
    try {
      await userService.deleteRole(id);
      toast.success(t("toasts.roleDeleted", { namespace: "users",  }));
      loadRoles();
    } catch (e) {
      toast.error(t("toasts.deleteFailed", { namespace: "users",  }) + e);
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <PageHeader
        title={t("title", { namespace: "users",  })}
        subtitle={t("subtitle", { namespace: "users",  })}
        breadcrumbs={[{ label: t("breadcrumbHome", { namespace: "users",  }), to: "/dashboard" }, { label: t("breadcrumbSettings", { namespace: "users",  }) }, { label: t("breadcrumbUsers", { namespace: "users",  }) }]}
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
            {activeTab === "users" ? t("actions.newUser", { namespace: "users",  }) : t("actions.newRole", { namespace: "users",  })}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatSummary label={t("stats.totalUsers", { namespace: "users",  })} value={users.length} icon={<UsersIcon />} />
        <StatSummary label={t("stats.activeUsers", { namespace: "users",  })} value={activeCount} icon={<ShieldCheck />} color="text-emerald-600" />
        <StatSummary label={t("stats.systemRoles", { namespace: "users",  })} value={roles.length} icon={<Shield />} color="text-blue-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 h-12 rounded-xl shadow-sm">
          <TabsTrigger value="users" className="rounded-lg px-6 gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <UsersIcon className="w-4 h-4" /> {t("tabs.users", { namespace: "users",  })}
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            <Shield className="w-4 h-4" /> {t("tabs.roles", { namespace: "users",  })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTable
            data={users}
            loading={usersLoading}
            search={search}
            onSearchChange={setSearch}
            roles={roles}
          />
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
