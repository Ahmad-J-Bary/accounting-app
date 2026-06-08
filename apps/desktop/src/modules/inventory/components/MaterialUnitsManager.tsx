import { useState, useEffect, useRef } from "react";
import { Button } from "@shared/ui/button";
import { X, Plus, Scale, Boxes, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { materialService } from '@modules/inventory/api/materialService';
import type { MaterialDto, MaterialUnitDto } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';
import { UnitCard } from './UnitCard';
import { AddUnitForm } from './AddUnitForm';

interface MaterialUnitsManagerProps {
  material: MaterialDto | null;
  onClose: () => void;
  onUnitsUpdated: () => void;
}

export function MaterialUnitsManager({ material, onClose, onUnitsUpdated }: MaterialUnitsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localUnits, setLocalUnits] = useState<MaterialUnitDto[] | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitData, setEditingUnitData] = useState<MaterialUnitDto | null>(null);
  const [pendingServerSync, setPendingServerSync] = useState(false);
  const prevUnitsRef = useRef(material?.units);

  useEffect(() => {
    if (pendingServerSync && material?.units && material.units !== prevUnitsRef.current) {
      setLocalUnits(null);
      setPendingServerSync(false);
    }
    prevUnitsRef.current = material?.units;
  }, [material?.units, pendingServerSync]);

  if (!material) return null;

  const displayUnits = localUnits ?? material.units ?? [];
  const baseUnit = displayUnits.find(u => u.is_base);
  const secondaryUnits = displayUnits.filter(u => !u.is_base);

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الوحدة؟")) return;
    setDeletingId(unitId);
    const deletedUnit = displayUnits.find(u => u.id === unitId);
    setLocalUnits(prev => (prev ?? material.units ?? []).filter(u => u.id !== unitId));
    try {
      await materialService.deleteMaterialUnit(unitId);
      toast.success("تم حذف الوحدة");
      onUnitsUpdated();
      setPendingServerSync(true);
    } catch (err) {
      if (deletedUnit) setLocalUnits(prev => [...(prev ?? material.units ?? []), deletedUnit]);
      toast.error("فشل حذف الوحدة: " + err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddUnit = async (unit: { name: string; conversion_factor: string; barcode: string }) => {
    if (displayUnits.some(u => u.name.toLowerCase() === unit.name.trim().toLowerCase())) {
      toast.error("يوجد وحدة بنفس الاسم مسبقاً");
      return;
    }
    const tempId = `temp_${Date.now()}`;
    const tempUnit: MaterialUnitDto = {
      id: tempId,
      material_id: material.id,
      name: unit.name,
      conversion_factor: unit.conversion_factor,
      barcode: unit.barcode || "",
      is_base: false,
    };
    setLocalUnits(prev => [...(prev ?? material.units ?? []), tempUnit]);

    try {
      await materialService.addMaterialUnit({
        material_id: material.id,
        name: unit.name,
        conversion_factor: unit.conversion_factor,
        barcode: unit.barcode || undefined,
      });
      toast.success("تمت إضافة الوحدة بنجاح");
      onUnitsUpdated();
      setPendingServerSync(true);
    } catch (err) {
      setLocalUnits(prev => prev?.filter(u => u.id !== tempId) ?? null);
      throw err;
    }
  };

  const handleEditUnit = (u: MaterialUnitDto) => {
    setEditingUnitId(u.id);
    setEditingUnitData({ ...u });
  };

  const handleUpdateEditingUnit = (field: string, value: string) => {
    setEditingUnitData(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleCancelEdit = () => {
    setEditingUnitId(null);
    setEditingUnitData(null);
  };

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            إدارة وحدات القياس
          </h2>
          <span className="text-xs text-muted-foreground">{material.name}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Base Unit */}
        <UnitCard
          key={`base-${editingUnitId === '__base__' ? 'edit' : 'view'}`}
          mode={editingUnitId === '__base__' ? "edit" : "view"}
          unit={editingUnitId === '__base__' && editingUnitData ? { name: editingUnitData.name, conversion_factor: editingUnitData.conversion_factor, barcode: editingUnitData.barcode || "" } : { name: baseUnit?.name || "قطعة", conversion_factor: baseUnit?.conversion_factor || "1", barcode: baseUnit?.barcode || "" }}
          index={0}
          isBase={true}
          baseUnitName={baseUnit?.name}
          onEdit={editingUnitId === '__base__' ? undefined : () => { setEditingUnitId('__base__'); setEditingUnitData(baseUnit ? { ...baseUnit } : null); }}
          onCancelEdit={editingUnitId === '__base__' ? handleCancelEdit : undefined}
          defaultCollapsed={editingUnitId !== '__base__'}
        />

        {/* Secondary Units Section */}
        <div>
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-bold text-slate-800">الوحدات الحالية ({secondaryUnits.length})</h3>
            <Button type="button" size="sm" onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5 h-8 text-xs font-bold rounded-lg shadow-sm"><Plus className="w-3.5 h-3.5" /> إضافة وحدة</Button>
          </div>

          {secondaryUnits.length === 0 && !showAddForm ? (
            <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed mt-3">
              <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-xs text-slate-400 mb-3">لا توجد وحدات إضافية معرفة لهذه المادة.</p>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="w-3.5 h-3.5 ml-1.5" />
                إضافة أول وحدة
              </Button>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {secondaryUnits.map((u: MaterialUnitDto) => {
                const isEditing = editingUnitId === u.id;
                return (
                  <UnitCard
                    key={`${u.id}-${isEditing ? 'edit' : 'view'}`}
                    mode={isEditing ? "edit" : "view"}
                    unit={isEditing && editingUnitData ? { name: editingUnitData.name, conversion_factor: editingUnitData.conversion_factor, barcode: editingUnitData.barcode || "" } : { name: u.name, conversion_factor: u.conversion_factor, barcode: u.barcode || "" }}
                    index={0}
                    isBase={false}
                    baseUnitName={baseUnit?.name}
                    onUpdate={isEditing ? handleUpdateEditingUnit : undefined}
                    onEdit={isEditing ? undefined : () => handleEditUnit(u)}
                    onCancelEdit={isEditing ? handleCancelEdit : undefined}
                    onDelete={() => handleDeleteUnit(u.id)}
                    deleteDisabled={deletingId === u.id}
                    showDeleteOnHover={true}
                    defaultCollapsed={!isEditing}
                  />
                );
              })}

              {showAddForm && (
                <AddUnitForm
                  baseUnitName={baseUnit?.name || "قطعة"}
                  materialName={material.name}
                  existingNames={displayUnits.map(u => u.name)}
                  onAdd={handleAddUnit}
                  onCancel={() => setShowAddForm(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="bg-amber-50/55 border border-amber-100 p-3.5 rounded-2xl flex gap-3 text-right">
          <Shuffle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 leading-relaxed font-semibold">
            <strong>تنبيه:</strong> الوحدة الأولى تعتبر <strong>الوحدة الأساسية</strong> للمستودعات. الوحدات الإضافية تُحسب كمعادلات تعادل كمية من الوحدة الأساسية (مثلاً: دزينة = 12 قطعة).
          </p>
        </div>
      </div>
    </div>
  );
}
