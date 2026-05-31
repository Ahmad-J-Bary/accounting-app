import { ArrowUpDown } from "lucide-react";

interface SortableHeaderProps {
  field: string;
  label: string;
  currentField: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
  stopPropagation?: boolean;
  className?: string;
}

export function SortableHeader({ 
  field, 
  label, 
  currentField, 
  direction, 
  onSort,
  stopPropagation = false,
  className = ""
}: SortableHeaderProps) {
  const getSortIcon = (f: string) => {
    if (currentField !== f) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return direction === "asc" 
      ? <ArrowUpDown className="w-3 h-3 rotate-180" /> 
      : <ArrowUpDown className="w-3 h-3" />;
  };

  return (
    <button 
      onClick={(e) => { 
        if (stopPropagation) e.stopPropagation(); 
        onSort(field); 
      }}
      className={`flex items-center gap-1 hover:text-slate-900 transition-colors ${className}`}
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
}
