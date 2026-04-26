import React, { useState, useEffect, useRef } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Trash2, 
  Calculator, 
  Package, 
  ChevronDown,
  Info
} from "lucide-react";
import { materialService } from "@/services/materialService";
import type { MaterialDto, InvoiceLineDto } from "@erp/shared-types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvoiceEditorProps {
  type: "Sales" | "Purchase" | "OpeningBalance";
  lines: InvoiceLineDto[];
  onChange: (lines: InvoiceLineDto[]) => void;
}

export function InvoiceEditor({ type, lines, onChange }: InvoiceEditorProps) {
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState<number | null>(null);

  useEffect(() => {
    materialService.listMaterials().then(setMaterials);
  }, []);

  const addLine = (material?: MaterialDto) => {
    const newLine: InvoiceLineDto = {
      material_id: material?.id || "",
      material_name: material?.name || "",
      barcode: material?.barcode || "",
      code: material?.code || "",
      quantity: "1",
      unit_price: "0",
      notes: "",
    };
    onChange([...lines, newLine]);
  };

  const updateLine = (index: number, updates: Partial<InvoiceLineDto>) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], ...updates };
    onChange(newLines);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    onChange(newLines);
  };

  const selectMaterial = (index: number, m: MaterialDto) => {
    updateLine(index, {
      material_id: m.id,
      material_name: m.name,
      barcode: m.barcode,
      code: m.code,
      purchase_price: m.purchase_price,
      minimum_stock: m.minimum_stock,
    });
    setShowResults(null);
  };

  const filteredMaterials = materials.filter(m => 
    m.name.includes(searchTerm) || 
    m.code.includes(searchTerm) || 
    (m.barcode && m.barcode.includes(searchTerm))
  );

  return (
    <div className="border rounded-md overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead className="w-64 text-right">المادة (اسم/كود/باركود)</TableHead>
            <TableHead className="w-24 text-center">الكمية</TableHead>
            <TableHead className="w-32 text-left">السعر</TableHead>
            {type === "OpeningBalance" && (
              <>
                <TableHead className="w-32 text-left">مفرق</TableHead>
                <TableHead className="w-32 text-left">جملة</TableHead>
                <TableHead className="w-24 text-center">حد الطلب</TableHead>
              </>
            )}
            <TableHead className="text-right">ملاحظات</TableHead>
            <TableHead className="w-32 text-left">الإجمالي</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={index} className="hover:bg-slate-50/50 group">
              <TableCell className="text-center text-muted-foreground font-mono">{index + 1}</TableCell>
              <TableCell className="relative">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 text-right font-medium focus-visible:ring-1"
                    placeholder="ابحث عن مادة..."
                    value={line.material_name || ""}
                    onFocus={() => setShowResults(index)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      updateLine(index, { material_name: e.target.value });
                    }}
                  />
                </div>
                {showResults === index && searchTerm && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-xl max-h-60 overflow-y-auto">
                    {filteredMaterials.map(m => (
                      <div
                        key={m.id}
                        className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center border-b last:border-0"
                        onClick={() => selectMaterial(index, m)}
                      >
                        <div className="flex flex-col text-right">
                          <span className="font-bold">{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.code} | {m.barcode}</span>
                        </div>
                        <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded tabular-nums">
                          مخزون: {m.stock_quantity}
                        </span>
                      </div>
                    ))}
                    {filteredMaterials.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        لا توجد نتائج
                      </div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="h-8 text-center tabular-nums focus-visible:ring-1"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <div className="relative">
                  <Input
                    type="number"
                    className="h-8 text-left tabular-nums pl-8 focus-visible:ring-1"
                    value={line.unit_price}
                    onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                  />
                  <Calculator className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                </div>
              </TableCell>
              
              {type === "OpeningBalance" && (
                <>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 text-left tabular-nums focus-visible:ring-1"
                      value={line.retail_price || ""}
                      onChange={(e) => updateLine(index, { retail_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 text-left tabular-nums focus-visible:ring-1"
                      value={line.wholesale_price || ""}
                      onChange={(e) => updateLine(index, { wholesale_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 text-center tabular-nums focus-visible:ring-1"
                      value={line.minimum_stock || ""}
                      onChange={(e) => updateLine(index, { minimum_stock: e.target.value })}
                      placeholder="0"
                    />
                  </TableCell>
                </>
              )}

              <TableCell>
                <Input
                  className="h-8 text-right focus-visible:ring-1"
                  value={line.notes || ""}
                  onChange={(e) => updateLine(index, { notes: e.target.value })}
                />
              </TableCell>
              <TableCell className="text-left font-bold tabular-nums">
                {formatCurrency(Number(line.quantity) * Number(line.unit_price))}
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeLine(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {lines.length === 0 && (
            <TableRow>
              <td colSpan={type === "OpeningBalance" ? 9 : 6} className="text-center py-8 text-muted-foreground italic">
                لا توجد سطور. اضغط على "إضافة سطر" للبدء.
              </td>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-white border-dashed border-2 hover:border-solid"
          onClick={() => addLine()}
        >
          <Plus className="w-4 h-4 ml-2" /> إضافة سطر (Enter)
        </Button>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground">عدد المواد:</span>
            <span className="font-bold tabular-nums">{lines.length}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-base">الإجمالي النهائي:</span>
            <span className="text-xl font-black text-primary tabular-nums">
              {formatCurrency(lines.reduce((acc, line) => acc + (Number(line.quantity) * Number(line.unit_price)), 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
