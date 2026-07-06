import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

interface HeaderFieldProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  type?: 'text' | 'date';
  className?: string;
  inputClassName?: string;
  children?: ReactNode;
  required?: boolean;
}

export function HeaderField({
  label,
  value,
  onChange,
  readOnly,
  disabled,
  placeholder,
  type = 'text',
  className,
  inputClassName,
  children,
  required,
}: HeaderFieldProps) {
  const isPassive = readOnly || disabled;

  return (
    <div
      dir="rtl"
      className={cn(
        'group relative flex items-center gap-1.5 rounded-lg border-2 bg-background px-2 py-1 transition-all duration-200',
        isPassive
          ? 'border-dashed border-border/40 bg-muted/[0.03]'
          : 'border-border/50 hover:border-primary/30 hover:shadow-sm',
        'focus-within:border-primary focus-within:shadow-[0_0_0_3px] focus-within:shadow-primary/10',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            'w-[3px] h-3 rounded-full transition-colors duration-200',
            isPassive
              ? 'bg-muted-foreground/20'
              : 'bg-primary/30 group-hover:bg-primary/50 group-focus-within:bg-primary',
          )}
        />
        <label
          className={cn(
            'text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-200 whitespace-nowrap',
            isPassive
              ? 'text-muted-foreground/40'
              : 'text-muted-foreground/50 group-hover:text-primary/60 group-focus-within:text-primary/70',
          )}
        >
          {label}
          {required && <span className="text-destructive mr-0.5">*</span>}
        </label>
      </div>

      {children ? (
        <div className="flex-1 min-w-0">
          {children}
        </div>
      ) : (
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          disabled={disabled}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none transition-colors duration-200',
            'text-sm font-medium text-foreground',
            'placeholder:text-muted-foreground/30',
            readOnly && 'font-bold cursor-default',
            disabled && 'cursor-not-allowed',
            type === 'date' && 'font-bold',
            inputClassName,
          )}
        />
      )}
    </div>
  );
}
