import { Card } from "@shared/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useLocalization } from "@app/providers/LocalizationProvider";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

interface ChartCardProps {
  title: string;
  icon: React.ElementType;
  data: { name: string; value: number }[];
  formatter: (v: number) => string;
}

export function ChartCard({
  title,
  icon: Icon,
  data,
  formatter,
}: ChartCardProps) {
  const { direction } = useLocalization();

  return (
    <Card className="group overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-black text-foreground">{title}</h3>
        </div>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={8}
              dataKey="value"
              stroke="none"
            >
              {data.map((_: unknown, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={formatter}
              contentStyle={{
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                direction,
              }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
