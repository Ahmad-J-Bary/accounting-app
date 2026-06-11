import { cn } from "@shared/lib/utils";
import { getAlignmentClass } from "@shared/lib/table-utils";
import type { MaterialDto, WarehouseDto } from "@erp/shared-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@shared/ui/dropdown-menu";
import type { DocumentColumn } from "./GenericDocumentGrid";
import type { GridLine } from "@modules/invoicing/lib/invoiceUtils";

export interface DocumentGridConfig {
  cellBorderClass: string;
  densityPadding: string;
  fontSize: number;
  fontFamily: string;
  readOnly: boolean;
  materials: MaterialDto[];
  warehouses: WarehouseDto[];
  getCellValue: (line: GridLine, key: string) => string;
  searchRow: number | null;
}

export interface DocumentGridCallbacks {
  onUpdateLine: (rowIdx: number, updates: Partial<GridLine>) => void;
  onCellChange: (rowIdx: number, colKey: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => void;
  onActiveCellChange: (cell: { row: number; col: number } | null) => void;
  onSearchRowChange: (rowIdx: number | null) => void;
  onSearchTypeChange: (type: "name" | "code" | "barcode") => void;
  onSearchTermChange: (term: string) => void;
  inputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
}

export interface DocumentGridCellProps {
  column: DocumentColumn;
  line: GridLine;
  rowIndex: number;
  editColIndex: number;
  isCellActive: boolean;
  refKey: string;
  config: DocumentGridConfig;
  callbacks: DocumentGridCallbacks;
}

function CellWrapper({
  column,
  children,
  config,
  isInteractive,
  isCellActive,
  isReadonlyCell,
}: {
  column: DocumentColumn;
  children: React.ReactNode;
  config: DocumentGridConfig;
  isInteractive?: boolean;
  isCellActive?: boolean;
  isReadonlyCell?: boolean;
}) {
  return (
    <div
      data-col-id={column.key}
      className={cn(
        cn(config.densityPadding, "flex items-center truncate text-center justify-center"),
        config.cellBorderClass,
        isInteractive && "relative",
        !isInteractive && "text-slate-600 transition-colors group-hover:text-slate-900",
        isReadonlyCell && "bg-gray-100/50",
        isCellActive && "ring-inset ring-2 ring-blue-400 z-20",
      )}
      style={{ minWidth: 0, fontSize: `${config.fontSize}px`, fontFamily: config.fontFamily }}
    >
      {children}
    </div>
  );
}

function ReadonlyContent({ value, fontSize, fontFamily }: { value: string; fontSize: number; fontFamily: string }) {
  return <span style={{ fontSize: `${fontSize}px`, fontFamily }}>{value}</span>;
}

function EditableInput({
  refKey,
  value,
  fontSize,
  fontFamily,
  align,
  onChange,
  onFocus,
  onKeyDown,
  inputRefs,
  placeholder,
  type,
}: {
  refKey: string;
  value: string;
  fontSize: number;
  fontFamily: string;
  align?: "right" | "left" | "center";
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  placeholder?: string;
  type?: string;
}) {
  const isNum = type === "number";
  return (
    <input
      ref={(el) => { if (el) inputRefs.current.set(refKey, el); else inputRefs.current.delete(refKey); }}
      type={isNum ? "number" : "text"}
      min={isNum ? "0" : undefined}
      step={isNum ? "any" : undefined}
      className={cn(
        "w-full bg-transparent border-none outline-none focus:bg-white transition-colors text-center",
        isNum ? "tabular-nums font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" : "font-bold text-blue-800 placeholder:text-slate-400",
      )}
      style={{ fontSize: `${fontSize}px`, fontFamily }}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      onChange={onChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    />
  );
}

export function DocumentGridCell({
  column: col,
  line,
  rowIndex: rowIdx,
  editColIndex: editColIdx,
  isCellActive,
  refKey,
  config,
  callbacks,
}: DocumentGridCellProps) {
  const { densityPadding: dp, fontSize, readOnly, materials, warehouses, getCellValue, searchRow, cellBorderClass } = config;
  const { onUpdateLine, onCellChange, onKeyDown, onActiveCellChange, onSearchRowChange, onSearchTypeChange, onSearchTermChange, inputRefs } = callbacks;

  if (col.type === "tier_select") {
    const material = materials.find((m) => m.id === line.material_id);
    const unitId = line.unit_id;
    const currentTier = line.tier || "retail";

    const tiers = [
      { id: "retail", label: "مفرق" },
      { id: "semi_wholesale", label: "نصف جملة" },
      { id: "wholesale", label: "جملة" },
    ];

    const handleTierChange = (tierId: string) => {
      if (readOnly || !line.material_id) return;
      const price = material?.sale_prices?.find(
        p => p.unit_id === unitId && p.tier === tierId
      );
      const basePrice = price?.price_base || price?.price || "0";
      onUpdateLine(rowIdx, { tier: tierId, unit_price: basePrice });
    };

    const currentTierPrice = material?.sale_prices?.find(
      p => p.unit_id === unitId && p.tier === currentTier
    );
    const currentMaxQty = currentTierPrice?.max_quantity ? parseInt(currentTierPrice.max_quantity) : 0;

    return (
      <CellWrapper column={col} config={config} isReadonlyCell={readOnly}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={readOnly || !line.material_id}>
            <button className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter transition-all",
              line.material_id
                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 cursor-pointer"
                : "bg-slate-50 text-slate-400 border-slate-200 cursor-default",
            )}>
              <span className="flex items-center gap-1">
                <span>{line.material_id ? (tiers.find(t => t.id === currentTier)?.label || "مفرق") : ""}</span>
                {currentMaxQty > 0 && <span className="text-[7px] text-amber-500 font-bold">&le;{currentMaxQty}</span>}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-[140px] shadow-xl">
            <DropdownMenuLabel className="text-right text-[9px] font-black text-slate-500 uppercase">نوع السعر</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tiers.map((t) => {
              const salePrice = material?.sale_prices?.find(
                p => p.unit_id === unitId && p.tier === t.id
              );
              const priceStr = salePrice ? `${salePrice.price || salePrice.price_base || ""}` : "";
              const maxQty = salePrice?.max_quantity ? parseInt(salePrice.max_quantity) : 0;
              return (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={currentTier === t.id}
                  onCheckedChange={() => handleTierChange(t.id)}
                  className="text-right flex-row-reverse gap-2 text-[10px] font-bold py-1.5"
                >
                  <span className="flex items-center gap-2 w-full">
                    <span>{t.label}</span>
                    {priceStr && <span className="tabular-nums text-slate-400 font-medium">{priceStr}</span>}
                    {maxQty > 0 && <span className="text-[8px] text-purple-500 font-bold mr-auto">&le;{maxQty}</span>}
                  </span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </CellWrapper>
    );
  }

  if (col.type === "readonly") {
    return (
      <CellWrapper column={col} config={config} isReadonlyCell>
        <ReadonlyContent value={getCellValue(line, col.key)} fontSize={fontSize} fontFamily={config.fontFamily} />
      </CellWrapper>
    );
  }

  if (col.type === "image") {
    const src = getCellValue(line, col.key);
    return (
      <CellWrapper column={col} config={config} isReadonlyCell>
        {src ? (
          <img src={src} alt="" className="w-6 h-6 object-contain rounded bg-slate-50 border border-slate-200" />
        ) : (
          <div className="w-6 h-6 rounded bg-slate-50 border border-dashed border-slate-200" />
        )}
      </CellWrapper>
    );
  }

  if (col.type === "badge") {
    return (
      <CellWrapper column={col} config={config} isReadonlyCell>
        <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
          {getCellValue(line, col.key)}
        </span>
      </CellWrapper>
    );
  }

  if (col.type === "unit_select") {
    const material = materials.find((m) => m.id === line.material_id);
    const units = material?.units || [];
    const currentUnit = getCellValue(line, col.key);
    return (
      <CellWrapper column={col} config={config} isReadonlyCell={readOnly}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={readOnly || !line.material_id}>
            <button className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter transition-all",
              line.material_id
                ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 cursor-pointer"
                : "bg-slate-50 text-slate-400 border-slate-200 cursor-default",
            )}>
              {line.material_id ? currentUnit || "اختر" : ""}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-[100px] shadow-xl">
            <DropdownMenuLabel className="text-right text-[9px] font-black text-slate-500 uppercase">الوحدات المتاحة</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {units.map((u) => (
              <DropdownMenuCheckboxItem
                key={u.id}
                checked={line.unit_id === u.id || currentUnit === u.name}
                onCheckedChange={() => onUpdateLine(rowIdx, { unit_id: u.id, unit_name: u.name })}
                className="text-right flex-row-reverse gap-2 text-[10px] font-bold py-1.5"
              >
                {u.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CellWrapper>
    );
  }

  if (col.type === "warehouse_select") {
    const currentWarehouseId = line.warehouse_id || "";
    const currentWarehouse = warehouses.find(w => w.id === currentWarehouseId);
    return (
      <CellWrapper column={col} config={config} isReadonlyCell={readOnly}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={readOnly}>
            <button className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded border tracking-tighter transition-all",
              currentWarehouseId
                ? "bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100 cursor-pointer"
                : "bg-slate-50 text-slate-400 border-slate-200 cursor-default",
            )}>
              {currentWarehouse?.name || "اختر المستودع"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-[140px] shadow-xl">
            <DropdownMenuLabel className="text-right text-[9px] font-black text-slate-500 uppercase">المستودعات</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {warehouses.map((w) => (
              <DropdownMenuCheckboxItem
                key={w.id}
                checked={currentWarehouseId === w.id}
                onCheckedChange={() => onUpdateLine(rowIdx, { warehouse_id: w.id })}
                className="text-right flex-row-reverse gap-2 text-[10px] font-bold py-1.5"
              >
                {w.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CellWrapper>
    );
  }

  if (col.type === "price_tier") {
    const currentTier = line.tier || "retail";
    const tiers = [
      { id: "retail", label: "مفرق" },
      { id: "semi_wholesale", label: "نصف جملة" },
      { id: "wholesale", label: "جملة" },
    ];
    const tierLabel = tiers.find(t => t.id === currentTier)?.label || "مفرق";
    const priceValue = getCellValue(line, col.key);

    const handleTierChange = (tierId: string) => {
      if (readOnly || !line.material_id) return;
      const material = materials.find(m => m.id === line.material_id);
      const price = material?.sale_prices?.find(
        p => p.unit_id === line.unit_id && p.tier === tierId
      );
      const basePrice = price?.price_base || price?.price || "0";
      onUpdateLine(rowIdx, { tier: tierId, unit_price: basePrice });
    };

    if (readOnly) {
      return (
        <CellWrapper column={col} config={config} isReadonlyCell>
          <span className="flex items-center gap-1.5 text-center justify-center">
            <span className="text-[8px] font-black px-1 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">{tierLabel}</span>
            <ReadonlyContent value={priceValue || "-"} fontSize={fontSize} fontFamily={config.fontFamily} />
          </span>
        </CellWrapper>
      );
    }

    return (
      <CellWrapper column={col} config={config} isInteractive isCellActive={isCellActive}>
        <span className="flex items-center gap-1 w-full text-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!line.material_id}>
              <button className={cn(
                "text-[8px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter transition-all shrink-0",
                line.material_id
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 cursor-pointer"
                  : "bg-slate-50 text-slate-400 border-slate-200 cursor-default",
              )}>
                {tierLabel}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[140px] shadow-xl">
              <DropdownMenuLabel className="text-right text-[9px] font-black text-slate-500 uppercase">نوع السعر</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tiers.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={currentTier === t.id}
                  onCheckedChange={() => handleTierChange(t.id)}
                  className="text-right flex-row-reverse gap-2 text-[10px] font-bold py-1.5"
                >
                  {t.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <EditableInput
            refKey={refKey}
            value={priceValue}
            fontSize={fontSize}
            fontFamily={config.fontFamily}
            inputRefs={inputRefs}
            onChange={(e) => onCellChange(rowIdx, col.key, e.target.value)}
            onFocus={() => onActiveCellChange({ row: rowIdx, col: editColIdx })}
            onKeyDown={(e) => onKeyDown(e, rowIdx, editColIdx)}
            type="number"
          />
        </span>
      </CellWrapper>
    );
  }

  if (col.type === "material" || col.type === "material_code" || col.type === "material_barcode") {
    const isCodeSearch = col.type === "material_code";
    const isBarcodeSearch = col.type === "material_barcode";
    let displayValue = line.material_name || "";
    if (isCodeSearch) displayValue = line.material_code || "";
    if (isBarcodeSearch) displayValue = line.unit_barcode || "";

    if (readOnly) {
      return (
        <CellWrapper column={col} config={config} isReadonlyCell>
          <ReadonlyContent value={displayValue || "-"} fontSize={fontSize} fontFamily={config.fontFamily} />
        </CellWrapper>
      );
    }

    const handleFocus = () => {
      onActiveCellChange({ row: rowIdx, col: editColIdx });
      onSearchRowChange(rowIdx);
      onSearchTypeChange(isCodeSearch ? "code" : isBarcodeSearch ? "barcode" : "name");
      onSearchTermChange(displayValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchTermChange(e.target.value);
      onSearchRowChange(rowIdx);
      onSearchTypeChange(isCodeSearch ? "code" : isBarcodeSearch ? "barcode" : "name");
      const update: Partial<GridLine> = {};
      if (isCodeSearch) { update.material_code = e.target.value; update.material_id = ""; }
      else if (isBarcodeSearch) { update.unit_barcode = e.target.value; update.material_id = ""; }
      else { update.material_name = e.target.value; update.material_id = ""; }
      onUpdateLine(rowIdx, update);
    };

    return (
      <CellWrapper column={col} config={config} isInteractive isCellActive={isCellActive}>
        <EditableInput
          refKey={refKey}
          value={displayValue}
          fontSize={fontSize}
          fontFamily={config.fontFamily}
          align={col.align}
          placeholder="البحث..."
          inputRefs={inputRefs}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={(e) => onKeyDown(e, rowIdx, editColIdx)}
        />
      </CellWrapper>
    );
  }

  if (readOnly) {
    return (
      <CellWrapper column={col} config={config} isReadonlyCell>
        <ReadonlyContent value={getCellValue(line, col.key) || "-"} fontSize={fontSize} fontFamily={config.fontFamily} />
      </CellWrapper>
    );
  }

  return (
    <CellWrapper column={col} config={config} isInteractive isCellActive={isCellActive}>
      <EditableInput
        refKey={refKey}
        value={getCellValue(line, col.key)}
        fontSize={fontSize}
        fontFamily={config.fontFamily}
        align={col.align}
        type={col.type}
        inputRefs={inputRefs}
        onChange={(e) => onCellChange(rowIdx, col.key, e.target.value)}
        onFocus={() => onActiveCellChange({ row: rowIdx, col: editColIdx })}
        onKeyDown={(e) => onKeyDown(e, rowIdx, editColIdx)}
      />
    </CellWrapper>
  );
}
