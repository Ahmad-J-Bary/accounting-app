import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@shared/ui/dialog";
import { Checkbox } from "@shared/ui/checkbox";
import type { Role, CreateRoleRequest } from "@erp/shared-types";
import { useLocalization } from '@app/providers/LocalizationProvider';

interface RoleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
  onSave: (payload: CreateRoleRequest & { id?: string }) => Promise<void>;
  saving: boolean;
}

const AVAILABLE_PERMISSIONS = [
  { id: "Admin", labelPath: "users.form.permissions.Admin" },
  { id: "Accounting", labelPath: "users.form.permissions.Accounting" },
  { id: "Inventory", labelPath: "users.form.permissions.Inventory" },
  { id: "Purchases", labelPath: "users.form.permissions.Purchases" },
  { id: "Sales", labelPath: "users.form.permissions.Sales" },
  { id: "Reports", labelPath: "users.form.permissions.Reports" },
  { id: "Settings", labelPath: "users.form.permissions.Settings" },
];

export function RoleForm({ open, onOpenChange, role, onSave, saving }: RoleFormProps) {
  const { t } = useLocalization();
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
          <DialogTitle>{role ? t("users.form.titleEdit", { namespace: "users",  }) : t("users.form.titleAddRole", { namespace: "users",  })}</DialogTitle>
          <DialogDescription>{t("users.form.descriptionRole", { namespace: "users",  })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{t("users.form.nameLabel", { namespace: "users",  })}</Label>
            <Input 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder={t("users.form.namePlaceholder", { namespace: "users",  })} 
              disabled={role?.is_system_role}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("users.form.descriptionLabel", { namespace: "users",  })}</Label>
            <Input 
              value={form.description} 
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              placeholder={t("users.form.descriptionPlaceholder", { namespace: "users",  })} 
            />
          </div>
          
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-bold">{t("users.form.permissionsLabel", { namespace: "users",  })}</Label>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {AVAILABLE_PERMISSIONS.map(p => (
                <div key={p.id} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox 
                    id={p.id} 
                    checked={form.permissions.includes(p.id)}
                    onCheckedChange={() => handleTogglePermission(p.id)}
                  />
                  <label htmlFor={p.id} className="text-xs cursor-pointer select-none">{t(p.labelPath, { namespace: "users"})}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("users.form.cancel", { namespace: "users",  })}</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || form.permissions.length === 0}>
            {saving ? t("users.form.saving", { namespace: "users",  }) : t("users.form.saveRole", { namespace: "users",  })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
