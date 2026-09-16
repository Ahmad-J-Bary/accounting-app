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
  blue: "bg-primary hover:bg-primary shadow-primary/20",
  emerald: "bg-success hover:bg-success shadow-success/20",
  rose: "bg-destructive hover:bg-destructive shadow-destructive/20",
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
