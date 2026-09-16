import { cn } from "@shared/lib/utils";

export function ReportTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-black text-muted-foreground border-b border-muted">
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
        "whitespace-nowrap px-3 py-2 text-sm border-b border-muted",
        highlight ? "font-bold text-foreground" : "font-medium text-foreground",
        className
      )}
    >
      {children}
    </td>
  );
}
