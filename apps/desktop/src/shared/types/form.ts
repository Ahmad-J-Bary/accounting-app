import type React from 'react';

// ── Field Types ─────────────────────────────────────────────
export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'tel'
  | 'url'
  | 'search'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'autocomplete'
  | 'date'
  | 'time'
  | 'datetime'
  | 'checkbox'
  | 'radio'
  | 'toggle'
  | 'file'
  | 'currency';

// ── Field Option ────────────────────────────────────────────
export interface FieldOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
  icon?: React.ReactNode;
}

// ── Field Config ────────────────────────────────────────────
export interface FormFieldConfig<T = string | number | boolean | null> {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  defaultValue?: T;
  options?: FieldOption[];
  validate?: (
    value: T,
    allValues: Record<string, unknown>,
  ) => string | null | Promise<string | null>;
  dependsOn?: string[];
  className?: string;
  containerClassName?: string;
}

// ── Form State ──────────────────────────────────────────────
export interface FormState<T extends Record<string, unknown> = Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

// ── UseForm Config ──────────────────────────────────────────
export interface UseFormConfig<T extends Record<string, unknown>> {
  initialValues: T;
  fields?: FormFieldConfig[];
  validate?: (values: T) => Partial<Record<keyof T, string>> | Promise<Partial<Record<keyof T, string>>>;
  onSubmit: (values: T) => Promise<void> | void;
  enableReinitialize?: boolean;
}

// ── UseForm Return ──────────────────────────────────────────
export interface UseFormReturn<T extends Record<string, unknown>> extends FormState<T> {
  handleChange: (name: string, value: string | number | boolean) => void;
  handleBlur: (name: string) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  setFieldValue: (name: string, value: string | number | boolean) => void;
  setFieldError: (name: string, error: string) => void;
  setFieldTouched: (name: string, touched: boolean) => void;
  reset: (values?: Partial<T>) => void;
  getFieldProps: (name: string) => {
    value: string | number | boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    disabled: boolean;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
  getFieldMeta: (name: string) => {
    error?: string;
    touched: boolean;
    isDirty: boolean;
  };
}
