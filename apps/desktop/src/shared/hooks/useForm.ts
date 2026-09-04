import { useState, useCallback, useEffect, useRef } from 'react';
import type { UseFormConfig, UseFormReturn } from '@shared/types/form';

type FieldValue = string | number | boolean;

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  fields = [],
  validate,
  onSubmit,
  enableReinitialize = false,
}: UseFormConfig<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialValuesRef = useRef(initialValues);

  useEffect(() => {
    if (enableReinitialize) {
      initialValuesRef.current = initialValues;
      setValues(initialValues);
      setErrors({});
      setTouched({});
      setIsDirty(false);
    }
  }, [initialValues, enableReinitialize]);

  const validateField = useCallback(
    (name: string, value: FieldValue | undefined, allValues: T): string | null => {
      const field = fields.find((f) => f.name === name);
      if (field?.validate) {
        const result = field.validate(value, allValues);
        if (result && typeof result === 'object' && typeof (result as Promise<string>).then === 'function') {
          return null;
        }
        return result as string | null;
      }
      if (field?.required && (value === undefined || value === null || value === '')) {
        return `${field.label} مطلوب`;
      }
      return null;
    },
    [fields],
  );

  const validateAllFields = useCallback(
    async (vals: T): Promise<Partial<Record<keyof T, string>>> => {
      const newErrors: Partial<Record<keyof T, string>> = {};

      for (const field of fields) {
        const error = validateField(field.name, vals[field.name] as FieldValue | undefined, vals);
        if (error) {
          newErrors[field.name as keyof T] = error;
        }
      }

      if (validate) {
        const customErrors = await validate(vals);
        Object.assign(newErrors, customErrors);
      }

      return newErrors;
    },
    [fields, validateField, validate],
  );

  const handleChange = useCallback(
    (name: string, value: FieldValue) => {
      setValues((prev) => {
        const newValues = { ...prev, [name]: value };
        setIsDirty(true);

        const error = validateField(name, value, newValues);
        setErrors((prevErrors) => {
          if (error) {
            return { ...prevErrors, [name]: error };
          }
          const { [name]: _, ...rest } = prevErrors;
          return rest as Partial<Record<keyof T, string>>;
        });

        return newValues;
      });
    },
    [validateField],
  );

  const handleBlur = useCallback((name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const allTouched: Partial<Record<keyof T, boolean>> = {};
      for (const field of fields) {
        allTouched[field.name as keyof T] = true;
      }
      setTouched(allTouched);

      const newErrors = await validateAllFields(values);
      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, fields, validateAllFields, onSubmit],
  );

  const setFieldValue = useCallback(
    (name: string, value: FieldValue) => {
      handleChange(name, value);
    },
    [handleChange],
  );

  const setFieldError = useCallback((name: string, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const setFieldTouched = useCallback((name: string, fieldTouched: boolean) => {
    setTouched((prev) => ({ ...prev, [name]: fieldTouched }));
  }, []);

  const reset = useCallback(
    (newValues?: Partial<T>) => {
      setValues(newValues ? { ...initialValues, ...newValues } : initialValues);
      setErrors({});
      setTouched({});
      setIsDirty(false);
    },
    [initialValues],
  );

  const getFieldProps = useCallback(
    (name: string) => {
      const field = fields.find((f) => f.name === name);
      return {
        value: (values[name] ?? '') as FieldValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
          const value: FieldValue =
            field?.type === 'checkbox'
              ? (e.target as HTMLInputElement).checked
              : e.target.value;
          handleChange(name, value);
        },
        onBlur: () => handleBlur(name),
        disabled: field?.disabled ?? false,
        'aria-invalid': !!errors[name as keyof T],
        'aria-describedby': errors[name as keyof T]
          ? `${name}-error`
          : undefined,
      };
    },
    [values, fields, errors, handleChange, handleBlur],
  );

  const getFieldMeta = useCallback(
    (name: string) => ({
      error: errors[name as keyof T],
      touched: touched[name as keyof T] ?? false,
      isDirty: values[name as keyof T] !== initialValuesRef.current[name],
    }),
    [errors, touched, values],
  );

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    reset,
    getFieldProps,
    getFieldMeta,
  };
}
