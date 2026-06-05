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
    if (currentField !== f) return null;
    return direction === "asc" 
      ? <ArrowUpDown className="w-2.5 h-2.5 rotate-180 mr-0.5 text-slate-400" /> 
      : <ArrowUpDown className="w-2.5 h-2.5 mr-0.5 text-slate-400" />;
  };

  return (
    <button 
      onClick={(e) => { 
        if (stopPropagation) e.stopPropagation(); 
        onSort(field); 
      }}
      className={`w-full h-full flex items-center justify-center hover:text-slate-900 transition-colors cursor-pointer ${className}`}
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
}
