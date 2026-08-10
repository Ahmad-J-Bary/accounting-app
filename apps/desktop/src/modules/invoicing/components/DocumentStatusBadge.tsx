import { CheckCircle2, Clock, Send, DollarSign, AlertCircle } from "lucide-react";
import { StatusBadge } from "@shared/ui/status-badge";
import type { StatusTone } from "@shared/ui/status";

export type DocumentStatus = "Draft" | "Saved" | "Posted" | "PartiallyPaid" | "FullyPaid" | "Cancelled";

const STATUS_ICON: Record<DocumentStatus, ReturnType<typeof Clock>> = {
  Draft: <Clock className="w-3 h-3" />,
  Saved: <CheckCircle2 className="w-3 h-3" />,
  Posted: <Send className="w-3 h-3" />,
  PartiallyPaid: <DollarSign className="w-3 h-3" />,
  FullyPaid: <DollarSign className="w-3 h-3" />,
  Cancelled: <AlertCircle className="w-3 h-3" />,
};

const STATUS_TONE: Record<DocumentStatus, StatusTone> = {
  Draft: "amber",
  Saved: "blue",
  Posted: "green",
  PartiallyPaid: "orange",
  FullyPaid: "emerald",
  Cancelled: "red",
};

function normalizeStatus(status: string): DocumentStatus {
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
  return (
    <StatusBadge
      status={normalized}
      icon={STATUS_ICON[normalized]}
      tone={STATUS_TONE[normalized]}
      size={size}
    />
  );
}