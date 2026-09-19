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
      ? <ArrowUpDown className="ms-0.5 h-2.5 w-2.5 rotate-180 text-muted-foreground" />
      : <ArrowUpDown className="ms-0.5 h-2.5 w-2.5 text-muted-foreground" />;
  };

  return (
    <button 
      onClick={(e) => { 
        if (stopPropagation) e.stopPropagation(); 
        onSort(field); 
      }}
      className={`flex h-full w-full cursor-pointer items-center justify-center transition-colors hover:text-foreground ${className}`}
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
}
