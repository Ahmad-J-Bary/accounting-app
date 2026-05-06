import { cn } from '@shared/lib/utils';

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case 'paid':
      case 'posted':
      case 'approved':
      case 'completed':
      case 'active':
      case 'balanced':
        return { className: 'bg-primary text-primary-foreground', label: 'مدفوع' };
      case 'pending':
      case 'draft':
      case 'processing':
        return { className: 'bg-secondary text-secondary-foreground', label: 'مسودة' };
      case 'overdue':
      case 'unpaid':
      case 'rejected':
      case 'cancelled':
      case 'unbalanced':
      case 'inactive':
        return { className: 'bg-destructive text-destructive-foreground', label: 'متأخر' };
      case 'partial':
        return { className: 'border border-border text-foreground', label: 'جزئي' };
      default:
        return { className: 'bg-secondary text-secondary-foreground', label: status };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', config.className, className)}>
      {config.label}
    </span>
  );
}