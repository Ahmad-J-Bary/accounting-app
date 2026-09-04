import React from 'react';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { Switch } from '@shared/ui/switch';
import { Checkbox } from '@shared/ui/checkbox';
import type { FormFieldConfig } from '@shared/types/form';

interface FormFieldProps {
  field: FormFieldConfig;
  value: string | number | boolean | null | undefined;
  error?: string;
  touched?: boolean;
  onChange: (value: string | number | boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

/** Convert field value to string for native inputs */
function toInputValue(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function FormField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled = false,
}: FormFieldProps) {
  const showError = !!(touched && error);
  const fieldId = `field-${field.name}`;
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;

  const inputClasses = `
    w-full
    ${showError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
  `;

  const renderInput = () => {
    switch (field.type) {
      case 'select':
        return (
          <Select
            value={toInputValue(value)}
            onValueChange={onChange}
            disabled={disabled || field.disabled}
          >
            <SelectTrigger
              className={inputClasses}
              aria-invalid={showError || undefined}
              aria-describedby={
                showError ? errorId : field.helpText ? helpId : undefined
              }
            >
              <SelectValue placeholder={field.placeholder ?? 'اختر...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem
                  key={String(opt.value)}
                  value={String(opt.value)}
                  disabled={opt.disabled}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            id={fieldId}
            value={toInputValue(value)}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled || field.disabled}
            readOnly={field.readOnly}
            placeholder={field.placeholder}
            rows={4}
            className={inputClasses}
            aria-invalid={showError || undefined}
            aria-describedby={
              showError ? errorId : field.helpText ? helpId : undefined
            }
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={fieldId}
              checked={!!value}
              onCheckedChange={(checked) => onChange(!!checked)}
              disabled={disabled || field.disabled}
            />
            <Label
              htmlFor={fieldId}
              className="text-sm font-normal cursor-pointer"
            >
              {field.label}
            </Label>
          </div>
        );

      case 'toggle':
        return (
          <div className="flex items-center justify-between">
            <Label htmlFor={fieldId} className="text-sm font-normal">
              {field.label}
            </Label>
            <Switch
              id={fieldId}
              checked={!!value}
              onCheckedChange={onChange}
              disabled={disabled || field.disabled}
            />
          </div>
        );

      default:
        return (
          <Input
            id={fieldId}
            type={field.type === 'currency' ? 'number' : field.type}
            value={toInputValue(value)}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled || field.disabled}
            readOnly={field.readOnly}
            placeholder={field.placeholder}
            step={field.type === 'currency' ? '0.01' : undefined}
            className={inputClasses}
            aria-invalid={showError || undefined}
            aria-describedby={
              showError ? errorId : field.helpText ? helpId : undefined
            }
          />
        );
    }
  };

  if (field.type === 'checkbox' || field.type === 'toggle') {
    return (
      <div className={field.containerClassName ?? 'space-y-2'}>
        {renderInput()}
        {showError && (
          <p id={errorId} className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        {field.helpText && !showError && (
          <p id={helpId} className="text-sm text-muted-foreground">
            {field.helpText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={field.containerClassName ?? 'space-y-2'}>
      <Label htmlFor={fieldId} className={showError ? 'text-red-500' : ''}>
        {field.label}
        {field.required && <span className="text-red-500 me-1">*</span>}
      </Label>
      {renderInput()}
      {showError && (
        <p id={errorId} className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {field.helpText && !showError && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {field.helpText}
        </p>
      )}
    </div>
  );
}
