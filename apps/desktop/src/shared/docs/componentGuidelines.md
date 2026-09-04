# Component Guidelines

## Shared Components

### FormField
Renders a form field with label, input, error, and help text.

**Props:**
- `field: FormFieldConfig` — Field configuration
- `value: any` — Current field value
- `error?: string` — Validation error message
- `touched?: boolean` — Whether field has been touched
- `onChange: (value: any) => void` — Value change handler
- `onBlur?: () => void` — Blur handler
- `disabled?: boolean` — Disabled state

**Supported field types:** `text`, `number`, `email`, `password`, `tel`, `url`, `search`, `textarea`, `select`, `multiselect`, `autocomplete`, `date`, `time`, `datetime`, `checkbox`, `radio`, `toggle`, `file`, `currency`

**Usage:**
```tsx
import { FormField } from '@shared/components/FormField';

<FormField
  field={{
    name: 'email',
    label: 'البريد الإلكتروني',
    type: 'email',
    required: true,
    placeholder: 'name@example.com',
  }}
  value={email}
  error={errors.email}
  touched={touched.email}
  onChange={setEmail}
  onBlur={() => handleBlur('email')}
/>
```

### FormShell
Auto-generated form from field definitions with submit/reset buttons.

**Props:**
- `fields: FormFieldConfig[]` — Array of field configs
- `onSubmit: (values) => void` — Submit handler
- `layout?: 'stacked' | 'inline' | 'grid' | 'two-column'` — Layout variant
- `showSubmit?: boolean` — Show submit button
- `showReset?: boolean` — Show reset button
- `title?: string` — Card title
- `description?: string` — Card description
- `onCancel?: () => void` — Cancel callback

**Usage:**
```tsx
import { FormShell } from '@shared/components/FormShell';

<FormShell
  fields={[
    { name: 'name', label: 'الاسم', type: 'text', required: true },
    { name: 'email', label: 'البريد', type: 'email', required: true },
    { name: 'role', label: 'الدور', type: 'select', options: [
      { value: 'admin', label: 'مدير' },
      { value: 'user', label: 'مستخدم' },
    ]},
  ]}
  onSubmit={handleSubmit}
  layout="grid"
  title="إضافة مستخدم"
/>
```

### ThemePreview
Renders a theme preview card with selection state.

**Props:**
- `theme: ThemeDefinition` — Theme definition
- `isSelected?: boolean` — Whether theme is selected
- `onClick: () => void` — Selection handler

### DensityPreview
Renders a density mode preview card with selection state.

**Props:**
- `mode: DensityMode` — Density mode
- `isSelected?: boolean` — Whether mode is selected
- `onClick: () => void` — Selection handler

---

## Hooks

### useForm
Form state management with validation. Lighter alternative to react-hook-form for simple forms.

**Config:**
- `initialValues: T` — Initial form values
- `fields?: FormFieldConfig[]` — Field configs for built-in validation
- `validate?: (values) => errors` — Custom validation
- `onSubmit: (values) => void` — Submit handler
- `enableReinitialize?: boolean` — Reset form when initialValues change

**Returns:**
- `values` — Form values
- `errors` — Validation errors
- `touched` — Touched fields
- `isSubmitting` — Submission state
- `isValid` — Form validity
- `isDirty` — Whether form has been modified
- `handleChange(name, value)` — Field change handler
- `handleBlur(name)` — Field blur handler
- `handleSubmit(e?)` — Form submit handler
- `setFieldValue(name, value)` — Set field value
- `setFieldError(name, error)` — Set field error
- `reset(values?)` — Reset form
- `getFieldProps(name)` — Get field props for native inputs
- `getFieldMeta(name)` — Get field metadata (error, touched, isDirty)

### useResponsive
Responsive mode detection based on viewport width.

**Returns:** `'mobile' | 'tablet' | 'desktop'`

- Mobile: width < 768px
- Tablet: 768px <= width < 1024px
- Desktop: width >= 1024px

### useKeyboardNavigation
Register global keyboard shortcuts.

**Config:**
```ts
shortcuts: Array<{
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
}>
```

**Usage:**
```tsx
import { useKeyboardNavigation } from '@shared/hooks/useKeyboardNavigation';

useKeyboardNavigation([
  { key: 'k', ctrlKey: true, action: () => openSearch(), description: 'فتح البحث' },
  { key: 't', ctrlKey: true, action: () => newTab(), description: 'علامة تبويب جديدة' },
]);
```

---

## Design Tokens

See `apps/desktop/src/shared/config/designTokens.ts` for:
- Typography (font families, sizes, weights, line heights)
- Spacing scale (0–16)
- Border radius (none, sm, md, lg, xl, 2xl, 3xl, full)
- Shadows (xs, sm, md, lg, xl, 2xl, none)
- Breakpoints (sm, md, lg, xl, 2xl)
- Z-index scale (base, dropdown, sticky, fixed, modal-backdrop, modal, popover, tooltip, toast)
- Transitions (fast, normal, slow, spring)
- Density presets (compact, comfortable, spacious)
- Sidebar density presets

### CSS Custom Properties (index.css)
All design tokens are also available as CSS custom properties:
- `--z-dropdown`, `--z-modal`, etc.
- `--transition-fast`, `--transition-normal`, etc.
- `--shadow-sm`, `--shadow-md`, etc.
- `--density-spacing-*`, `--density-font-*`

### RTL/LTR Utility Classes
CSS logical property utilities are available in `index.css`:
- `ps-*` (padding-inline-start)
- `pe-*` (padding-inline-end)
- `ms-*` (margin-inline-start)
- `me-*` (margin-inline-end)
- `text-start`, `text-end`
- `border-s`, `border-e`
- `rounded-s`, `rounded-e`
- `absolute-start-*`, `absolute-end-*`
- `inset-s-*`, `inset-e-*`

---

## Responsive Provider

Wrap your app with `<ResponsiveProvider>` to access responsive state:

```tsx
import { useResponsiveContext } from '@app/providers/ResponsiveProvider';

function MyComponent() {
  const { mode, isMobile, isTablet, isDesktop } = useResponsiveContext();

  if (isMobile) {
    return <MobileLayout />;
  }
  return <DesktopLayout />;
}
```
