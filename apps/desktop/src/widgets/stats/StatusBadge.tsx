import { cn } from '@shared/lib/utils';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLocalization();
  const getStatusConfig = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case 'paid':
      case 'posted':
      case 'approved':
      case 'completed':
      case 'active':
      case 'balanced':
        return { className: 'bg-primary text-primary-foreground', label: t('status.paid', { namespace: 'common' }) };
      case 'pending':
      case 'draft':
      case 'processing':
        return { className: 'bg-secondary text-secondary-foreground', label: t('status.draft', { namespace: 'common' }) };
      case 'overdue':
      case 'unpaid':
      case 'rejected':
      case 'cancelled':
      case 'unbalanced':
      case 'inactive':
        return { className: 'bg-destructive text-destructive-foreground', label: t('status.overdue', { namespace: 'common' }) };
      case 'partial':
        return { className: 'border border-border text-foreground', label: t('status.partial', { namespace: 'common' }) };
      default:
        return { className: 'bg-secondary text-secondary-foreground', label: status };
    }
  };

  const config = getStatusConfig(status || "");

  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', config.className, className)}>
      {config.label}
    </span>
  );
}