import { type ReactNode } from "react";
import { Button } from "@shared/ui/button";

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: "amber" | "red" | "blue" | "emerald" | "rose";
  disabled?: boolean;
}

const COLOR_MAP = {
  amber: "bg-amber-500 hover:bg-amber-600 shadow-amber-100",
  red: "bg-red-500 hover:bg-red-600 shadow-red-100",
  blue: "bg-blue-600 hover:bg-blue-700 shadow-blue-100",
  emerald: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
  rose: "bg-rose-500 hover:bg-rose-600 shadow-rose-100",
};

export function ActionButton({
  icon,
  label,
  onClick,
  color = "amber",
  disabled,
}: ActionButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`text-white border-none h-8 px-3 rounded-lg text-xs font-bold gap-1 shadow-sm ${COLOR_MAP[color]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </Button>
  );
}
