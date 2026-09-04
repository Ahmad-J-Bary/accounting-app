import React from 'react';
import { useForm } from '@shared/hooks/useForm';
import { FormField } from '@shared/components/FormField';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { Separator } from '@shared/ui/separator';
import type { UseFormConfig } from '@shared/types/form';

interface FormShellProps<T extends Record<string, unknown>>
  extends Omit<UseFormConfig<T>, 'onSubmit'> {
  /** Layout variant */
  layout?: 'stacked' | 'inline' | 'grid' | 'two-column';
  /** Show submit button */
  showSubmit?: boolean;
  /** Show reset button */
  showReset?: boolean;
  /** Submit button label */
  submitLabel?: string;
  /** Reset button label */
  resetLabel?: string;
  /** Loading state */
  loading?: boolean;
  /** Additional CSS class for the form */
  className?: string;
  /** On cancel callback */
  onCancel?: () => void;
  /** On submit handler */
  onSubmit: (values: T) => Promise<void> | void;
  /** Card title */
  title?: string;
  /** Card description */
  description?: string;
  /** Children to render after form fields */
  children?: React.ReactNode;
}

export function FormShell<T extends Record<string, unknown>>({
  layout = 'stacked',
  showSubmit = true,
  showReset = false,
  submitLabel = 'حفظ',
  resetLabel = 'إعادة تعيين',
  loading = false,
  className,
  onCancel,
  title,
  description,
  children,
  ...formConfig
}: FormShellProps<T>) {
  const form = useForm(formConfig);

  const layoutClasses = {
    stacked: 'space-y-4',
    inline: 'flex items-end gap-4 flex-wrap',
    grid: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    'two-column': 'grid grid-cols-1 lg:grid-cols-2 gap-4',
  };

  const content = (
    <form
      onSubmit={form.handleSubmit}
      className={`${layoutClasses[layout]} ${className}`}
      noValidate
    >
      {formConfig.fields?.map((field) => {
        const meta = form.getFieldMeta(field.name);
        return (
          <FormField
            key={field.name}
            field={field}
            value={form.values[field.name] as string | number | boolean | null | undefined}
            error={meta.error}
            touched={meta.touched}
            onChange={(value) => form.setFieldValue(field.name, value)}
            onBlur={() => form.handleBlur(field.name)}
            disabled={loading}
          />
        );
      })}

      {children}

      {(showSubmit || showReset || onCancel) && (
        <>
          <Separator className="my-4" />
          <div className="flex items-center justify-end gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                إلغاء
              </Button>
            )}
            {showReset && (
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={loading}
              >
                {resetLabel}
              </Button>
            )}
            {showSubmit && (
              <Button type="submit" disabled={loading || !form.isValid}>
                {loading ? 'جاري الحفظ...' : submitLabel}
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );

  if (title) {
    return (
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {content}
      </Card>
    );
  }

  return content;
}
