import { cn } from "@shared/lib/utils";

export function ReportTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-black text-slate-500 border-b border-slate-200">
      {children}
    </th>
  );
}

export function ReportTableCell({
  children,
  highlight,
  className,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-2 text-sm border-b border-slate-100",
        highlight ? "font-bold text-slate-900" : "font-medium text-slate-700",
        className
      )}
    >
      {children}
    </td>
  );
}
