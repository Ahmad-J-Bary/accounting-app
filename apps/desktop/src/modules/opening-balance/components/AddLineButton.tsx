import { Plus } from "lucide-react";
import { Button } from "@shared/ui/button";
import { cn } from "@shared/lib/utils";

interface AddLineButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function AddLineButton({ onClick, label = "إضافة بند", className }: AddLineButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-10 w-full justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-white font-bold text-blue-700 shadow-none transition-all hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-300",
        className,
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Plus className="h-3.5 w-3.5" />
      </span>
      {label}
    </Button>
  );
}