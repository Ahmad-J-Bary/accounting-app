import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateUserRequest, Role } from "@erp/shared-types";
import { useLocalization } from '@app/providers/LocalizationProvider';

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onSave: (payload: CreateUserRequest) => Promise<void>;
  saving: boolean;
}

export function UserForm({ open, onOpenChange, roles, onSave, saving }: UserFormProps) {
  const { t } = useLocalization();
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
          <DialogTitle>{t("users.form.titleAdd", { namespace: "users",  })}</DialogTitle>
          <DialogDescription>{t("users.form.description", { namespace: "users",  })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{t("users.form.fullNameLabel", { namespace: "users",  })}</Label>
            <Input value={form.full_name ?? ""} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder={t("users.form.fullNamePlaceholder", { namespace: "users",  })} />
          </div>
          <div className="space-y-1">
            <Label>{t("users.form.usernameLabel", { namespace: "users",  })}</Label>
            <Input value={form.username ?? ""} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder={t("users.form.usernamePlaceholder", { namespace: "users",  })} />
          </div>
          <div className="space-y-1">
            <Label>{t("users.form.passwordLabel", { namespace: "users",  })}</Label>
            <Input type="password" value={form.password ?? ""} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>{t("users.form.roleLabel", { namespace: "users",  })}</Label>
            <Select value={form.role_id} onValueChange={v => setForm(p => ({ ...p, role_id: v }))}>
              <SelectTrigger><SelectValue placeholder={t("users.form.rolePlaceholder", { namespace: "users",  })} /></SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("users.form.cancel", { namespace: "users",  })}</Button>
          <Button onClick={handleSave} disabled={saving || !form.username || !form.full_name || !form.password || !form.role_id}>
            {saving ? t("users.form.saving", { namespace: "users",  }) : t("users.form.save", { namespace: "users",  })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
