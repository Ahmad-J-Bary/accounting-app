import { Card } from "@/components/ui/card";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconBg?: string;
  color?: string;
  textColor?: string;
}

export function StatCard({ label, value, icon, iconBg, color, textColor }: StatCardProps) {
  if (icon) {
    return (
      <Card className={cn(`p-4 flex items-center gap-4 border-r-4 shadow-sm`, color)}>
        <div className={cn(`p-3 rounded-full`, iconBg || textColor?.replace('text-', 'bg-').replace('600', '100').replace('primary', 'primary/10'))}>
          <div className={textColor}>{icon}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn("text-xl font-bold tabular-nums", textColor)}>{value}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        {label}
      </div>
      <div className={cn("text-2xl font-bold tabular-nums mt-1", color)}>{value}</div>
    </Card>
  );
}
