import { useState, useEffect } from 'react';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Switch } from '@shared/ui/switch';
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { SidebarSection } from '@widgets/sidebar-shell/SidebarSection';
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { toast } from 'sonner';
import { Warehouse, MapPin } from 'lucide-react';
import type { WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest } from '@erp/shared-types';
import { warehouseService } from '@modules/inventory/api/warehouseService';

interface WarehouseFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editItem?: WarehouseDto | null;
}

export function WarehouseForm({ open, onClose, onSaved, editItem }: WarehouseFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.name);
        setAddress(editItem.address || '');
        setIsActive(editItem.is_active);
        setIsDefault(editItem.is_default);
      } else {
        setName('');
        setAddress('');
        setIsActive(true);
        setIsDefault(false);
      }
    }
  }, [editItem, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('اسم المستودع مطلوب');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        const req: UpdateWarehouseRequest = {
          id: editItem.id,
          name: name.trim(),
          address: address.trim() || null,
          is_active: isActive,
          is_default: isDefault,
        };
        await warehouseService.updateWarehouse(req);
        toast.success('تم تحديث المستودع');
      } else {
        const req: CreateWarehouseRequest = {
          name: name.trim(),
          address: address.trim() || null
        };
        await warehouseService.createWarehouse(req);
        toast.success('تم إنشاء المستودع');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <FormPanel
      title={editItem ? "تعديل مستودع" : "إضافة مستودع جديد"}
      icon={<Warehouse className="w-5 h-5 text-blue-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!name.trim()}
      saveLabel={editItem ? "حفظ التغييرات" : "إضافة"}
    >
      <SidebarSection icon={<Warehouse className="w-3.5 h-3.5" />} title="بيانات المستودع" defaultOpen={true}>
        <div className="space-y-2.5 text-right">
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required><Warehouse className="w-3.5 h-3.5 text-slate-400" /> الاسم</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المستودع" className="bg-white border-slate-200 h-9" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> الموقع</FieldLabel>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الموقع (اختياري)" className="bg-white border-slate-200 h-9" />
          </div>
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-3">
              <Switch id="warehouseIsActive" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="warehouseIsActive" className="text-sm font-medium cursor-pointer">نشط</Label>
            </div>
            {editItem && (
              <div className="flex items-center gap-3">
                <Switch id="warehouseIsDefault" checked={isDefault} onCheckedChange={setIsDefault} />
                <Label htmlFor="warehouseIsDefault" className="text-sm font-medium cursor-pointer">افتراضي</Label>
              </div>
            )}
          </div>
        </div>
      </SidebarSection>
    </FormPanel>
  );
}
