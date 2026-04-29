import { CheckCircle2, Clock, Send, DollarSign, AlertCircle } from "lucide-react";

export type DocumentStatus = "Draft" | "Saved" | "Posted" | "PartiallyPaid" | "FullyPaid" | "Cancelled";

const STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  icon: React.ReactNode;
  className: string;
}> = {
  Draft: {
    label: "مسودة",
    icon: <Clock className="w-3 h-3" />,
    className: "bg-amber-50 text-amber-700 ring-amber-200 border-amber-200",
  },
  Saved: {
    label: "محفوظ",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "bg-blue-50 text-blue-700 ring-blue-200 border-blue-200",
  },
  Posted: {
    label: "مرحّل",
    icon: <Send className="w-3 h-3" />,
    className: "bg-green-50 text-green-700 ring-green-200 border-green-200",
  },
  PartiallyPaid: {
    label: "مدفوع جزئياً",
    icon: <DollarSign className="w-3 h-3" />,
    className: "bg-orange-50 text-orange-700 ring-orange-200 border-orange-200",
  },
  FullyPaid: {
    label: "مدفوع بالكامل",
    icon: <DollarSign className="w-3 h-3" />,
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200 border-emerald-200",
  },
  Cancelled: {
    label: "ملغي",
    icon: <AlertCircle className="w-3 h-3" />,
    className: "bg-red-50 text-red-700 ring-red-200 border-red-200",
  },
};

export function normalizeStatus(status: string): DocumentStatus {
  const map: Record<string, DocumentStatus> = {
    Draft: "Draft",
    draft: "Draft",
    Saved: "Saved",
    Posted: "Posted",
    posted: "Posted",
  };
  return map[status] ?? "Draft";
}

interface DocumentStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function DocumentStatusBadge({ status, size = "sm" }: DocumentStatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const config = STATUS_CONFIG[normalized];

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ring-1 ring-inset border rounded-full
      ${size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1"}
      ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
