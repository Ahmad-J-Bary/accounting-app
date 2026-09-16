# Almowakeb — UI/UX & Visual Design System

> **Status:** Target design authority  
> **Scope:** React/Tauri frontend UI/UX, visual language, interaction patterns, responsiveness, accessibility, RTL/LTR, and guidance for developers and AI coding agents.  
> **Baseline:** current `main` source was inspected before writing this document. This file distinguishes **Current**, **Problem**, **Target**, **Rule**, and **Recommendation**.

---

## Table of Contents

- [0. Authority and Goals](#0-authority-and-goals)
- [1. Product Identity](#1-product-identity)
- [2. Design Principles](#2-design-principles)
- [3. Current Design Foundation](#3-current-design-foundation)
- [4. Color System](#4-color-system)
- [5. Typography System](#5-typography-system)
- [6. Spacing System](#6-spacing-system)
- [7. Layout System](#7-layout-system)
- [8. Responsive Design](#8-responsive-design)
- [9. PageHeader and Action System](#9-pageheader-and-action-system)
- [10. Buttons](#10-buttons)
- [11. Forms](#11-forms)
- [12. Cards and Panels](#12-cards-and-panels)
- [13. Tables and Data-Dense UI](#13-tables-and-data-dense-ui)
- [14. Financial Data](#14-financial-data)
- [15. Dashboard and Charts](#15-dashboard-and-charts)
- [16. Navigation and Information Architecture](#16-navigation-and-information-architecture)
- [17. Settings](#17-settings)
- [18. Dialogs, Drawers, Popovers, Menus](#18-dialogs-drawers-popovers-menus)
- [19. Tabs, Search, Filters, Sorting, Pagination](#19-tabs-search-filters-sorting-pagination)
- [20. State System](#20-state-system)
- [21. Accessibility](#21-accessibility)
- [22. RTL / LTR](#22-rtl--ltr)
- [23. Icons](#23-icons)
- [24. Motion](#24-motion)
- [25. Shadows, Borders, and Radius](#25-shadows-borders-and-radius)
- [26. Layering](#26-layering)
- [27. UX Patterns](#27-ux-patterns)
- [28. Current Problems and Audit Notes](#28-current-problems-and-audit-notes)
- [29. Migration Strategy](#29-migration-strategy)
- [30. AI-Agent Rules](#30-ai-agent-rules)
- [31. Page-Level Design Rules](#31-page-level-design-rules)
- [32. Quality Checklist](#32-quality-checklist)
- [33. Decision Rule for Ambiguity](#33-decision-rule-for-ambiguity)
- [34. Final Design Authority](#34-final-design-authority)

---

## 0. Authority and Goals

`DESIGN.md` is the single source of truth for Almowakeb visual and interaction design. It does not claim that the current implementation already conforms to every rule. It records the current foundation, its inconsistencies, and the target system to migrate toward incrementally.

Almowakeb is an Arabic-first ERP accounting and inventory desktop application. The UI must feel reliable, restrained, information-dense, predictable, responsive, and accessible. Financial readability takes priority over decoration.

### Mandatory rules for UI work

1. Reuse an existing shared primitive/template before creating a new one.
2. Prefer semantic design tokens over literal visual values.
3. Fix systemic problems in shared components rather than duplicating page-level patches.
4. Preserve localization and RTL/LTR behavior.
5. Do not change accounting/business semantics during visual work.
6. Responsive behavior must be intentional; do not simply shrink desktop layouts.
7. Accessibility is part of the component contract.

---

## 1. Product Identity

### Current

The application is Tauri 2 + React 18 + TypeScript with Vite, Tailwind CSS 3, shadcn/Radix primitives, Lucide icons, React Hook Form, TanStack Query, React Router, Recharts, Sonner, and `next-themes`. The frontend is organized into modules and shared composite widgets.

Current feature modules include accounting, audit, auth, core, dashboard, expenses, fixed assets, inventory, invoicing, opening balance, partners, payments, reports, and users.

Current reusable widget/template families include dashboard, document shell, form shell, master-detail, page header, reports, sidebar shell, stats, table shell, tree sidebar, and shared templates such as `PageHeader`, `DashboardLayout`, `FinancialDocumentTemplate`, `HierarchicalTreeTemplate`, `OperationalTableTemplate`, `SettingsLayout`, `SettingsManagerLayout`, and `TemplateDetailPanel`.

### Target character

- Professional and calm
- Clear financial hierarchy
- Efficient for dense operational work
- Visually consistent across modules
- Minimal decorative noise
- Strong Arabic RTL support with equally valid English LTR presentation

---

## 2. Design Principles

### Clarity
Make important actions, totals, warnings, and errors easy to find.

### Consistency
Equivalent interactions should look and behave the same throughout the product.

### Hierarchy
Do not make every element visually prominent. Primary actions and important data must dominate secondary information.

### Efficiency
The product is an ERP; dense tables and forms are expected. Density must be controlled rather than avoided.

### Predictability
Create, edit, delete, export, save, cancel, search, filter, sort, retry, and confirm interactions should follow consistent patterns.

### Accessibility
Keyboard use, focus, contrast, labels, touch targets, reduced motion, and semantic HTML are mandatory.

### Responsiveness
Layouts may structurally change when space is constrained. Do not rely on shrinking every control.

### Financial restraint
Financial screens should optimize readability of values and relationships before visual novelty.

---

## 3. Current Design Foundation

### Theme and semantic colors

The current Tailwind theme maps CSS variables to semantic tokens:

- `background`, `foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `muted`, `muted-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `border`, `input`, `ring`
- sidebar equivalents

Dark mode is class-based.

### Typography

The current application bundles Cairo and Tajawal fonts and uses Cairo with Tajawal/system fallbacks. Existing weights are intentionally limited rather than arbitrary.

### Density and scale

The base stylesheet already exposes density tokens and three UI-scale modes (`small`, `default`, `large`). These are the preferred foundation for future sizing work.

### Layering, motion, shadows

The current stylesheet defines semantic z-index, transition, and shadow scales. New UI must reuse them instead of inventing arbitrary `z-index`, duration, or shadow values.

### Direction

RTL is the default. The stylesheet also exposes logical helpers such as `ms`, `me`, `ps`, `pe`, `text-start`, `text-end`, `border-s`, and `border-e`.

---

## 4. Color System

### Semantic roles

| Token | Use |
|---|---|
| `background` | Main application canvas |
| `card` | Normal surface/panel |
| `popover` | Floating surface/menu |
| `primary` | Main constructive action/selection |
| `secondary` | Supporting actions |
| `muted` | Low-emphasis surfaces |
| `accent` | Hover/selection emphasis |
| `destructive` | Dangerous/irreversible actions |
| `border` | Structural separation |
| `input` | Input borders/fields |
| `ring` | Keyboard focus |
| `foreground` | Primary text |
| `muted-foreground` | Supporting text |
| status colors | Success, warning, error, information |

### Rules

- Do not invent a new color literal if a semantic token covers the intent.
- Status colors must not be the only carrier of meaning.
- Light and dark themes must preserve hierarchy, not merely invert colors.
- Brand/identity colors may be introduced only as documented semantic tokens.

### Target additions

Where the source currently lacks dedicated semantic variables, future work may add `success`, `warning`, and `info` tokens instead of scattering green/yellow/blue literals.

---

## 5. Typography System

### Roles

- Display: onboarding only
- Page title
- Section title
- Card title
- Body
- Label
- Helper text
- Caption
- Table body
- Navigation
- Numeric/data

### Rules

- Keep page titles compact and strong; this is an ERP, not a marketing site.
- Use a predictable type scale.
- Do not introduce page-specific fonts.
- Use tabular numerals for financial data where supported.
- Helper/error text must remain readable on narrow screens.

---

## 6. Spacing System

The project should converge on a small spacing vocabulary, centered approximately around:

`2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`

Use the existing density and scale variables as the first source of truth.

### Rules

- Component internals use compact spacing.
- Cards/sections use medium spacing.
- Major page regions use larger spacing.
- Narrow screens should reduce outer whitespace before reducing control usability.
- Arbitrary values require justification.

---

## 7. Layout System

The target hierarchy is:

`Global navigation → optional local navigation → PageHeader → content`

Not every page requires every layer.

### Containers

Use available content width. Add maximum widths only when the content itself benefits from a readable limit.

### Sidebars

- Desktop: persistent navigation when useful.
- Laptop: compact/collapsible when content pressure rises.
- Tablet: collapsible/drawer.
- Narrow: avoid multiple competing permanent sidebars.

Settings are a special case: on narrow layouts, do not spend most of the viewport on both global navigation and a large settings sidebar.

---

## 8. Responsive Design

### Target strategy

| Size | Default strategy |
|---|---|
| Narrow | Single column, compact navigation, overflow actions |
| Mobile | Full-width content, one-column forms |
| Tablet | Collapsible sidebars, fewer grid columns |
| Laptop | Preserve density, reduce navigation footprint |
| Desktop | Full multi-column layouts when useful |
| Large desktop | Wider content without uncontrolled stretching |

### Structural transformations

- Tree/detail may become master → detail.
- Secondary navigation may become a drawer.
- Header actions may become primary + More.
- Dense grids may reduce columns.
- Multi-column forms may become one column.

Do not solve all responsive problems using `flex-wrap` alone.

---

## 9. PageHeader and Action System

### Current

`PageHeader` currently supports title, subtitle, badge, pin action, sticky behavior, and a generic `ReactNode` actions slot. Its layout is mobile-first flex-based.

### Target

Header actions should progressively use semantic descriptors with explicit priority:

- primary
- secondary
- tertiary
- overflow

A shared responsive action component should measure the **actions container**, not the whole window, and determine which actions remain inline versus overflowed.

### Rules

- Business importance is declared explicitly by the page.
- Responsive infrastructure changes presentation only; it must not change business availability.
- Primary actions stay visible whenever physically possible.
- Secondary/tertiary actions may move into a More menu.
- Overflow items preserve label, icon, disabled/loading state, intent, accessibility, and handler behavior.
- Confirmation dialogs remain the responsibility of the action handler, not the responsive action renderer.
- Filter toolbars remain filters; they should not be forced into action descriptors simply to normalize layout.

---

## 10. Buttons

The shared Button currently uses CVA variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, and `link`; sizes include `default`, `sm`, `lg`, and `icon`.

### Target usage

- Primary action: default/primary
- Secondary action: outline/secondary
- Tertiary: ghost/link
- Destructive: destructive
- Icon-only: only when discoverable and accessible

Do not create page-specific button variants for ordinary use cases.

---

## 11. Forms

### Layout

- Desktop: two columns when fields are logically grouped and space permits.
- Tablet: reduce columns as content compresses.
- Narrow: one column.

### Field anatomy

`label → control → helper/error`

Required/optional meaning must be explicit. Validation errors should stay close to the relevant field and preserve user-entered values where possible.

Save is the primary form action; Cancel is secondary; destructive operations are clearly separated.

---

## 12. Cards and Panels

Cards are grouping tools, not decoration.

Use cards for dashboard summaries, settings sections, and distinct supporting groups. Avoid deep nesting of cards without a strong hierarchy reason.

The current `erp-card` visual basis is appropriate: semantic card surface + border + moderate radius + restrained shadow.

---

## 13. Tables and Data-Dense UI

Tables are core ERP infrastructure.

### Rules

- Align financial/numeric values consistently.
- Prefer tabular numerals.
- Make totals stronger than normal rows without overdecorating every row.
- Keep headers distinct but not heavy.
- Preserve readable density.
- Avoid accidental body-wide horizontal scrolling.
- Use contained horizontal scrolling when a genuinely wide table requires it.

### Responsive behavior

Desktop: full columns.

Tablet: reduce secondary columns and preserve primary data.

Narrow: contained horizontal scroll or a deliberately compact alternative.

### Data priority

1. Important totals
2. Primary values
3. Supporting values
4. Metadata

---

## 14. Financial Data

### Currency
Use the shared currency/formatting architecture.

### Dates
Use locale/region-aware formatting with unambiguous context where necessary.

### Debit/Credit/Balance
Keep numeric alignment stable and readable at high density.

### Positive/negative
Do not rely solely on color. Signs and contextual labels must remain understandable without color perception.

---

## 15. Dashboard and Charts

Dashboard hierarchy:

`identity → KPIs → major trends/warnings → supporting charts/tables`

Charts must use the semantic theme palette and remain readable in both themes. Decoration must never overpower financial values.

---

## 16. Navigation and Information Architecture

Navigation must communicate:

- where the user is
- what section is active
- what actions are available
- how to return to parent context

Active states should be stronger than hover states. Collapsed navigation requires clear tooltips/accessible names.

---

## 17. Settings

Current `SettingsLayout` uses a responsive grid with sidebar/content at `lg` and stacked layout below it. `SettingsSection` uses semantic card styling with responsive padding.

### Target

Settings categories include company data, serial numbers, currency, financial settings, warehouses, language/region, export, data/backups, security/access, about, and appearance.

On narrow screens, local settings navigation should become a compact switcher/drawer rather than competing with the global application sidebar.

---

## 18. Dialogs, Drawers, Popovers, Menus

Use the existing Radix-backed primitives.

- Dialog: focused task
- Alert dialog: destructive confirmation
- Drawer/sheet: narrow-screen navigation/auxiliary content
- Dropdown/menu: compact actions/overflow
- Popover: contextual lightweight selection

Do not create custom overlay systems when an existing primitive is suitable.

---

## 19. Tabs, Search, Filters, Sorting, Pagination

Tabs represent peer views within the same context.

Search should distinguish system-wide search from page filtering.

Filters are controls and should collapse appropriately on narrow screens.

Sorting indicators must remain subtle and accessible.

Pagination is secondary to the data and must remain keyboard accessible.

---

## 20. State System

Every interactive component should define consistent:

- default
- hover
- focus
- active
- selected
- disabled
- loading
- success
- warning
- error
- empty/read-only

### Loading
Use skeletons for predictable content regions and localized spinners for short operations.

### Empty
Distinguish "no data" from "no results after filtering".

### Error
State what failed and whether Retry is available.

### Success
Use concise toast/inline confirmation depending on whether the information must remain visible.

---

## 21. Accessibility

- Use semantic HTML first.
- Ensure keyboard traversal and logical focus order.
- Preserve visible `focus-visible` rings.
- Give icon-only controls accessible names.
- Keep touch targets usable.
- Do not use color as the sole status signal.
- Respect reduced-motion preferences.
- Use ARIA only when semantics are not already provided by native HTML/Radix primitives.

---

## 22. RTL / LTR

RTL is the default presentation. English must remain first-class.

### Use

- `ms/me`
- `ps/pe`
- `text-start/end`
- `border-s/e`

### Avoid new use of

- `ml/mr`
- `pl/pr`
- `text-left/right`

unless the meaning is explicitly physical.

Only directional icons should mirror. Semantic icons such as search, settings, edit, delete, save, and currency do not mirror automatically.

---

## 23. Icons

Lucide React is the default icon library.

Approximate target sizes:

- 14px: dense metadata
- 16px: normal controls
- 18–20px: prominent toolbar actions
- 24px+: dashboard/hero/status where justified

Do not mix incompatible icon families without a documented reason.

---

## 24. Motion

Use the existing transition tokens.

- Fast: ~150ms
- Normal: ~200ms
- Slow: ~300ms
- Spring: only for deliberately expressive interactions

Motion should explain state change. It should never be required for comprehension and should respect reduced motion.

---

## 25. Shadows, Borders, and Radius

Prefer structure through semantic borders and restrained surface contrast. Use stronger shadows only for truly elevated/floating surfaces.

Use the existing radius scale derived from `--radius` rather than inventing many unrelated radii.

---

## 26. Layering

Use the existing semantic z-index scale:

`base < dropdown < sticky < fixed < modal-backdrop < modal < popover < tooltip < toast`

Do not introduce arbitrary extreme z-index values without a documented integration requirement.

---

## 27. UX Patterns

### Create
Primary constructive action.

### Edit
Consistent with create, but clearly edit-oriented.

### Delete
Destructive; confirmation where irreversible.

### Export
Secondary/tertiary. On narrow headers it may move into overflow.

### Save/Cancel
Save is primary; Cancel is secondary.

### Retry/Refresh
Use standardized icon/label patterns.

### Undo
Prefer when an operation can be safely reversed and the architecture supports it.

---

## 28. Current Problems and Audit Notes

### 28.1 Header action density

Legacy PageHeader accepts arbitrary `ReactNode` actions. Large action groups can wrap or consume excessive width. The target is semantic responsive actions with explicit priority and container-based measurement.

### 28.2 Settings navigation pressure

Settings can involve multiple navigation layers. Narrow layouts should prioritize content and collapse secondary navigation.

### 28.3 Legacy CSS

`App.css` still contains starter/demo-style selectors and variables (`.counter`, `.hero`, `#next-steps`, etc.). These are not part of the intended ERP visual vocabulary and should not be copied into new UI.

### 28.4 Physical-direction drift

The project has logical direction helpers, but new code must consistently prefer logical properties to prevent RTL regressions.

### 28.5 Responsive drift

Different pages may currently use different wrapping, grid, or fixed-width strategies. Normalize repeated patterns in shared templates rather than writing page-specific CSS.

### 28.6 Documentation drift

The existing architecture document contains older version/count information than the current repository. Current source is the implementation baseline. This design document governs UI intent.

---

## 29. Migration Strategy

### Stage 1 — Global tokens

1. semantic colors
2. typography
3. spacing
4. scale/density
5. radius/shadow/motion/z-index
6. responsive primitives

### Stage 2 — Core primitives

1. Button
2. Input/select/textarea
3. Form field/label
4. Dialog/drawer/popover/dropdown
5. Table primitives
6. Badge/alert/toast

### Stage 3 — Shared composites

1. PageHeader
2. responsive action group
3. FormShell
4. TableShell
5. MasterDetail
6. tree/sidebar templates
7. Settings layouts
8. Document shell

### Stage 4 — High-impact surfaces

Prioritize Settings, Inventory/Materials, Customers/Suppliers, Invoicing, Payments, Accounting, Reports, and Dashboard.

### Stage 5 — Long tail

Normalize remaining one-off styles and legacy patterns after shared foundations stabilize.

Do not rewrite the application in one pass.

---

## 30. AI-Agent Rules

When modifying UI:

```text
1. Search shared UI and templates first.
2. Reuse an existing component when possible.
3. Use semantic design tokens before literal values.
4. Preserve localization.
5. Preserve RTL and LTR.
6. Preserve keyboard/focus accessibility.
7. Prefer shared responsive logic over page-level conditions.
8. Explicitly declare action priority; never infer business importance from position.
9. Do not change business/accounting meaning during visual refactors.
10. Do not introduce a new visual pattern without documenting the reason.
11. Avoid arbitrary spacing/colors/radii/z-index.
12. Validate narrow layouts, not only desktop.
13. Validate both light and dark themes.
14. Validate Arabic RTL and English LTR.
15. If a design decision is repeated, promote it to a shared primitive/template.
```

---

## 31. Page-Level Design Rules

### Operational lists

`PageHeader → search/filter controls → table/list → pagination/summary`

Keep create/primary actions prominent; secondary exports and utilities yield first under width pressure.

### Hierarchical pages

`navigation/tree → detail`

On narrow screens use master → detail rather than forcing both panels side-by-side.

### Financial documents

`document identity → context/actions → line items → totals → metadata`

### Reports

`report identity → period/filter controls → key totals → report body → supporting detail`

### Settings

`settings identity → local settings navigation → content sections`

### Dashboard

`KPIs → key alerts/trends → supporting charts/tables`

---

## 32. Quality Checklist

### Visual

- [ ] Semantic colors used
- [ ] Approved typography roles used
- [ ] Approved spacing used
- [ ] Consistent radius/shadows
- [ ] No duplicate visual pattern

### Responsive

- [ ] Narrow layout tested
- [ ] No accidental page-wide horizontal overflow
- [ ] Headers adapt action presentation
- [ ] Tables remain usable
- [ ] Forms adapt structure
- [ ] Sidebars collapse intentionally

### Accessibility

- [ ] Keyboard accessible
- [ ] Visible focus
- [ ] Accessible icon-only actions
- [ ] Adequate contrast
- [ ] Usable touch targets

### Localization / direction

- [ ] Arabic works
- [ ] English works
- [ ] RTL works
- [ ] LTR works
- [ ] Logical properties used

### UX

- [ ] Primary action obvious
- [ ] Destructive actions distinct
- [ ] Loading/error/empty/success states deliberate
- [ ] Search/filter/sort/pagination predictable

### Architecture

- [ ] Shared components reused
- [ ] No duplicate provider/system
- [ ] No page-specific workaround for a shared problem
- [ ] New repeated pattern documented

---

## 33. Decision Rule for Ambiguity

When this document does not answer a design question explicitly:

1. Reuse the closest existing shared pattern.
2. Prefer semantic tokens.
3. Prefer accessibility and usability over decoration.
4. Prefer responsive structural adaptation over shrinking controls.
5. Prefer RTL/LTR-neutral logical layout.
6. Prefer a shared solution if the pattern will repeat.
7. Document a genuinely new convention before repeating it.

---

## 34. Final Design Authority

Almowakeb should feel like one coherent accounting product rather than a collection of modules created at different times.

The target experience is:

**calm visual hierarchy + high information density + strong financial readability + responsive structure + accessible interaction + Arabic-first directionality + reusable shared components.**

New UI should look as though it belongs to Almowakeb even when the reviewer has never seen the underlying code.

---

## Source inspection notes

This document was written after inspection of the current repository structure and key UI infrastructure on `main`, including `App.tsx`, `PageHeader.tsx`, `SettingsLayout.tsx`, `tailwind.config.ts`, `index.css`, the shared Button primitive, the modules tree, and the widgets/templates tree.

The current repository is the source of truth for **Current** behavior. This document is the source of truth for **Target** UI/UX behavior.

---

## 35. Appearance Settings — Complete Reference

### 35.1 Layout Types

| Layout | Name | Sidebar | TopBar | Navbar | Tabs | Shell Variant |
|---|---|---|---|---|---|---|
| `vertical` | عمودي | visible | visible | none | yes | vertical |
| `topnav-slim` | شريط علوي نحيف | hidden | slim | full | yes | topnav |
| `navbar-horizontal` | شريط أفقي | hidden | visible | full | yes | horizontal |
| `horizontal-slim` | شريط أفقي نحيف | hidden | slim | slim | yes | horizontal |
| `combo-nav` | مدمج | visible | visible | full | yes | combo |
| `combo-nav-slim` | مدمج نحيف | visible | slim | slim | yes | combo |
| `combo-nav-stacked` | مدمج مكدس | visible | visible | full | yes | combo |

### 35.2 Navigation Menu Types

| Type | Description |
|---|---|
| `sidenav` | Sidebar-only navigation |
| `topnav` | Top navigation only |
| `combo` | Combined sidebar + top navigation |

### 35.3 Sidebar Shapes

| Shape | Description |
|---|---|
| `default` | Standard sidebar |
| `stacked` | Stacked sidebar with grouped sections |

### 35.4 Top Navigation Shapes

| Shape | Description |
|---|---|
| `default` | Standard top navigation |
| `slim` | Compact top navigation |
| `stacked` | Stacked top navigation |

### 35.5 Navigation Appearance

| Appearance | Description |
|---|---|
| `light` | Light-colored navigation |
| `dark` | Dark-colored navigation |

### 35.6 Theme System

The application supports 10 themes with light/dark mode variants:

| Theme ID | Name | Name Ar | Base Mode | Supports Mode Toggle |
|---|---|---|---|---|
| `default-light` | Default Light | افتراضي فاتح | light | Yes |
| `default-dark` | Default Dark | افتراضي داكن | dark | Yes |
| `system` | System | حسب النظام | light | Yes |
| `luxury` | Luxury | فاخر | light | Yes |
| `retro` | Retro | حنيني | light | Yes |
| `arctic` | Arctic | قطبي | light | Yes |
| `nature` | Nature | طبيعي | light | Yes |
| `ember` | Ember | جمرة | light | No |
| `dracula` | Dracula | دراكيولا | dark | No |
| `midnight` | Midnight | ليل | dark | No |

### 35.7 Color Mode

| Mode | Description |
|---|---|
| `light` | Light theme |
| `dark` | Dark theme |
| `system` | Follows OS preference |

### 35.8 Primary Color Presets

| ID | Name | Name Ar | HSL |
|---|---|---|---|
| `blue` | Blue | أزرق | 221 83% 53% |
| `red` | Red | أحمر | 0 84% 60% |
| `green` | Green | أخضر | 142 76% 36% |
| `purple` | Purple | بنفسجي | 265 89% 58% |
| `orange` | Orange | برتقالي | 24 95% 55% |
| `gold` | Gold | ذهبي | 43 100% 50% |
| `pink` | Pink | وردي | 335 75% 60% |
| `indigo` | Indigo | نيلي | 230 90% 60% |
| `cyan` | Cyan | سماوي | 195 85% 50% |
| `emerald` | Emerald | زمردي | 160 84% 39% |
| `amber` | Amber | كهرماني | 38 92% 50% |
| `violet` | Violet | أرجواني | 270 85% 56% |

### 35.9 Density Modes

| Mode | Description | Row Height | Font Size |
|---|---|---|---|
| `compact` | Reduced spacing for dense data | 2rem | 0.8125rem |
| `comfortable` | Standard spacing (default) | 2.5rem | 0.875rem |
| `spacious` | Increased spacing for accessibility | 3rem | 0.9375rem |

### 35.10 UI Scale

| Scale | Multiplier | Description |
|---|---|---|
| `small` | 0.875x | Compact interface |
| `default` | 1x | Standard interface |
| `large` | 1.125x | Larger interface |

### 35.11 Tab Styles

| Style | Description |
|---|---|
| `default` | Standard tab bar |
| `browser` | Browser-style tabs |
| `vscode` | VS Code-style tabs |

### 35.12 Motion Mode

| Mode | Description |
|---|---|
| `full` | Full animations |
| `reduced` | Reduced animations for accessibility |

### 35.13 Visibility Settings

| Setting | Description |
|---|---|
| `sidebar` | Show/hide sidebar |
| `topBar` | Show/hide top bar |
| `tabs` | Show/hide tab bar |
| `search` | Show/hide search |
| `notifications` | Show/hide notifications |
| `breadcrumbs` | Show/hide breadcrumbs |

### 35.14 Sidebar Overrides

| Setting | Type | Description |
|---|---|---|
| `collapsed` | boolean | Sidebar collapsed state |
| `groupHeaders` | boolean | Show/hide group headers |
| `icons` | boolean | Show/hide icons |
| `bordered` | boolean | Show/hide border |
| `width` | number | Sidebar width (pixels) |
| `fontSize` | number | Sidebar font size |
| `background` | string | Sidebar background class |
| `activeBg` | string | Active item background class |
| `hoverBg` | string | Hover item background class |
| `collapseBehavior` | enum | free / accordion / all-expanded |
| `headerStyle` | enum | classic / card / line |

### 35.15 Sidebar Background Options

| Option | Label | Color |
|---|---|---|
| `bg-slate-900` | داكن | #0f172a |
| `bg-slate-950` | داكن جداً | #020617 |
| `bg-slate-800` | رمادي داكن | #1e293b |
| `bg-white` | أبيض | #ffffff |
| `bg-slate-50` | رمادي فاتح | #f8fafc |

---

## 36. Complete Component Documentation

### 36.1 Shared UI Components (`shared/ui/`)

#### Button (`button.tsx`)
- **Variants:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- **Sizes:** `default` (h-10 px-4), `sm` (h-9 px-3), `lg` (h-11 px-8), `icon` (h-10 w-10)
- **Usage:** Primary actions, secondary actions, destructive actions, icon-only buttons
- **Rule:** Do not create page-specific button variants

#### Input (`input.tsx`)
- **Height:** h-10 (40px default)
- **Usage:** Text input, number input, search
- **States:** default, focus (ring-2 ring-ring), disabled, placeholder

#### Textarea (`textarea.tsx`)
- **Min height:** 80px
- **Usage:** Multi-line text input

#### Select (`select.tsx`)
- **Height:** h-10
- **Parts:** Select, SelectTrigger, SelectContent, SelectItem, SelectValue
- **Usage:** Dropdown selection

#### Checkbox (`checkbox.tsx`)
- **Usage:** Boolean selection

#### Switch (`switch.tsx`)
- **Size:** h-6 w-11
- **Thumb size:** h-5 w-5
- **Usage:** Toggle on/off

#### Badge (`badge.tsx`)
- **Variants:** `default`, `secondary`, `destructive`, `outline`
- **Usage:** Status indicators, labels

#### Alert (`alert.tsx`)
- **Variants:** `default`, `destructive`
- **Parts:** Alert, AlertTitle, AlertDescription
- **Usage:** Status messages, warnings

#### Dialog (`dialog.tsx`)
- **Parts:** Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription
- **Usage:** Modal dialogs, confirmations
- **Max width:** max-w-lg

#### AlertDialog (`alert-dialog.tsx`)
- **Parts:** AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel
- **Usage:** Destructive confirmations

#### Sheet (`sheet.tsx`)
- **Sides:** top, bottom, left, right
- **Max width:** sm:max-w-sm
- **Usage:** Slide-in panels, drawers

#### Tabs (`tabs.tsx`)
- **Parts:** Tabs, TabsList, TabsTrigger, TabsContent
- **Height:** h-10
- **Usage:** Tabbed interfaces

#### Card (`card.tsx`)
- **Parts:** Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **Base styles:** rounded-lg border bg-card text-card-foreground shadow-sm
- **Usage:** Content grouping, panels

#### Tooltip (`tooltip.tsx`)
- **Side offset:** 4
- **Usage:** Hover hints

#### DropdownMenu (`dropdown-menu.tsx`)
- **Parts:** DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator
- **Min width:** min-w-[8rem]
- **Usage:** Context menus, action menus

#### Popover (`popover.tsx`)
- **Usage:** Lightweight floating content

#### Skeleton (`skeleton.tsx`)
- **Styles:** animate-pulse rounded-md bg-muted
- **Usage:** Loading placeholders

#### Progress (`progress.tsx`)
- **Height:** h-4
- **Usage:** Progress indicators

#### Pagination (`pagination.tsx`)
- **Parts:** Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis
- **Usage:** Page navigation

#### Form (`form.tsx`)
- **Parts:** Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage
- **Usage:** Form validation, field management

#### Label (`label.tsx`)
- **Styles:** text-sm font-medium leading-none
- **Usage:** Form labels

#### StatusBadge (`status-badge.tsx`)
- **Tones:** slate, amber, blue, green, orange, emerald, red, rose
- **Sizes:** sm (text-2xs px-2), md (text-xs px-3)
- **Usage:** Status indicators

#### ConfirmDialog (`confirm-dialog.tsx`)
- **Usage:** Confirmation dialogs
- **Props:** open, title, description, confirmLabel, cancelLabel, destructive, onConfirm

#### ScrollArea (`scroll-area.tsx`)
- **Usage:** Custom scrollbars

#### Separator (`separator.tsx`)
- **Usage:** Visual dividers

#### Avatar (`avatar.tsx`)
- **Usage:** User avatars

#### Calendar (`calendar.tsx`)
- **Usage:** Date picker

#### DatePicker (`date-picker.tsx`)
- **Usage:** Date selection

#### CurrencyField (`CurrencyField.tsx`)
- **Usage:** Currency input

#### Combobox (`combobox.tsx`)
- **Usage:** Searchable dropdown

#### Command (`command.tsx`)
- **Usage:** Command palette (via cmdk)

#### Accordion (`accordion.tsx`)
- **Usage:** Collapsible sections

#### Collapsible (`collapsible.tsx`)
- **Usage:** Collapsible content

#### Toggle (`toggle.tsx`)
- **Usage:** Toggle buttons

#### Slider (`slider.tsx`)
- **Usage:** Range input

#### RadioGroup (`radio-group.tsx`)
- **Usage:** Radio button selection

#### Sonner (`sonner.tsx`)
- **Usage:** Toast notifications

#### SortableHeader (`sortable-header.tsx`)
- **Usage:** Sortable table headers

#### ErrorBoundary (`ErrorBoundary.tsx`)
- **Usage:** Error handling

#### BarcodeScanDialog (`BarcodeScanDialog.tsx`)
- **Usage:** Barcode scanning

#### HeaderField (`header-field.tsx`)
- **Usage:** Header form fields

#### SectionCard (`section-card.tsx`)
- **Usage:** Section containers

#### Sidebar (`sidebar.tsx`)
- **Usage:** Sidebar navigation

#### Table (`table.tsx`)
- **Usage:** Data tables

#### Sheet (`sonner.tsx`)
- **Usage:** Toast notifications via Sonner

### 36.2 Widget Components (`widgets/`)

#### PageHeader (`widgets/templates/PageHeader.tsx`)
- **Props:** title, subtitle, badge, actions, pinAction, pinLabel, sticky, className
- **Sticky:** default true, z-20
- **Usage:** Page headers with actions

#### SettingsLayout (`widgets/templates/SettingsLayout.tsx`)
- **Parts:** SettingsLayout (grid sidebar/content), SettingsSection (card with header)
- **Layout:** grid-cols-12, sidebar lg:col-span-3, content lg:col-span-9
- **Usage:** Settings pages

#### DashboardLayout (`widgets/templates/DashboardLayout.tsx`)
- **Usage:** Dashboard pages

#### FinancialDocumentTemplate (`widgets/templates/FinancialDocumentTemplate.tsx`)
- **Usage:** Invoice/document pages

#### HierarchicalTreeTemplate (`widgets/templates/HierarchicalTreeTemplate.tsx`)
- **Usage:** Tree-based navigation pages

#### OperationalTableTemplate (`widgets/templates/OperationalTableTemplate.tsx`)
- **Usage:** Table-based operational pages

#### TemplateDetailPanel (`widgets/templates/TemplateDetailPanel.tsx`)
- **Usage:** Detail panel in templates

#### FormPanel (`widgets/form-shell/FormPanel.tsx`)
- **Props:** title, subtitle, icon, onClose, onSave, isSaving, children, footer, width, forceOverlay, saveLabel, saveDisabled
- **Usage:** Form side panels

#### Form (`widgets/form-shell/Form.tsx`)
- **Usage:** Form wrapper

#### DateField (`widgets/form-shell/DateField.tsx`)
- **Usage:** Date input field

#### TableShell (`widgets/table-shell/TableShell.tsx`)
- **Props:** title, search, onSearchChange, columns, onColumnToggle, actions, children, footer, filterBar
- **Usage:** Data table containers

#### SharedTable (`widgets/table-shell/SharedTable.tsx`)
- **Usage:** Shared table component

#### UnifiedTable (`widgets/table-shell/UnifiedTable.tsx`)
- **Usage:** Unified table component

#### DataTable (`widgets/table-shell/DataTable.tsx`)
- **Usage:** Data table component

#### EmptyState (`widgets/table-shell/EmptyState.tsx`)
- **Usage:** Empty state displays

#### LoadingState (`widgets/table-shell/LoadingState.tsx`)
- **Usage:** Loading states

#### TableToolbar (`widgets/table-shell/TableToolbar.tsx`)
- **Usage:** Table toolbar with search, filters, column toggle

#### TablePagination (`widgets/table-shell/TablePagination.tsx`)
- **Usage:** Table pagination

#### TableSummary (`widgets/table-shell/TableSummary.tsx`)
- **Usage:** Table summary/totals row

#### TableActions (`widgets/table-shell/TableActions.tsx`)
- **Usage:** Table row actions

#### ReportTableCells (`widgets/table-shell/ReportTableCells.tsx`)
- **Usage:** Report-specific table cells

#### ReportTableWrapper (`widgets/table-shell/ReportTableWrapper.tsx`)
- **Usage:** Report table wrapper

#### DetailPanel (`widgets/sidebar-shell/DetailPanel.tsx`)
- **Usage:** Detail side panels

#### SidebarShell (`widgets/sidebar-shell/SidebarShell.tsx`)
- **Usage:** Sidebar containers

#### SidebarHeader (`widgets/sidebar-shell/SidebarHeader.tsx`)
- **Usage:** Sidebar header

#### SidebarFooter (`widgets/sidebar-shell/SidebarFooter.tsx`)
- **Usage:** Sidebar footer with save/cancel

#### SidebarBody (`widgets/sidebar-shell/SidebarBody.tsx`)
- **Usage:** Sidebar body content

#### SidebarSection (`widgets/sidebar-shell/SidebarSection.tsx`)
- **Usage:** Sidebar sections

#### SidebarFieldGroup (`widgets/sidebar-shell/SidebarFieldGroup.tsx`)
- **Usage:** Sidebar field groups

#### SidebarDetailGrid (`widgets/sidebar-shell/SidebarDetailGrid.tsx`)
- **Usage:** Sidebar detail grid

#### SidebarDetailField (`widgets/sidebar-shell/SidebarDetailField.tsx`)
- **Usage:** Sidebar detail fields

#### SidebarValidationSummary (`widgets/sidebar-shell/SidebarValidationSummary.tsx`)
- **Usage:** Sidebar validation errors

#### SidebarEmptyState (`widgets/sidebar-shell/SidebarEmptyState.tsx`)
- **Usage:** Sidebar empty state

#### SidebarActionBar (`widgets/sidebar-shell/SidebarActionBar.tsx`)
- **Usage:** Sidebar action bar

#### ActionButton (`widgets/sidebar-shell/ActionButton.tsx`)
- **Usage:** Sidebar action buttons

#### DialogForm (`widgets/sidebar-shell/DialogForm.tsx`)
- **Usage:** Dialog-based forms

#### FieldLabel (`widgets/sidebar-shell/FieldLabel.tsx`)
- **Usage:** Sidebar field labels

#### FinancialMetricCard (`widgets/dashboard/FinancialMetricCard.tsx`)
- **Usage:** Dashboard metric cards

#### ReceivablesPayablesCard (`widgets/dashboard/ReceivablesPayablesCard.tsx`)
- **Usage:** Receivables/payables dashboard cards

#### DashboardSection (`widgets/dashboard/DashboardSection.tsx`)
- **Usage:** Dashboard sections

#### IconPicker (`widgets/IconPicker/`)
- **Usage:** Icon selection

#### MasterDetail (`widgets/master-detail/`)
- **Usage:** Master list + detail pane layout

#### TreeSidebar (`widgets/tree-sidebar/`)
- **Usage:** Hierarchical tree sidebar (e.g. CoA)

#### Stats (`widgets/stats/`)
- **Usage:** Statistics display cards

#### Reports (`widgets/reports/`)
- **Usage:** Report generation and display

---

## 37. Design Token Reference

### 37.1 Color Tokens (CSS Variables)

```css
/* Light Theme */
--background: 210 40% 98%;
--foreground: 222 47% 11%;
--card: 0 0% 100%;
--card-foreground: 222 47% 11%;
--popover: 0 0% 100%;
--popover-foreground: 222 47% 11%;
--primary: 215 52% 25%;
--primary-foreground: 210 40% 98%;
--secondary: 210 40% 96%;
--secondary-foreground: 222 47% 11%;
--muted: 210 40% 96%;
--muted-foreground: 215 16% 47%;
--accent: 210 40% 94%;
--accent-foreground: 222 47% 11%;
--destructive: 0 72% 51%;
--destructive-foreground: 210 40% 98%;
--border: 214 32% 91%;
--input: 214 32% 91%;
--ring: 215 52% 25%;
--radius: 0.5rem;

/* Dark Theme */
--background: 222 47% 6%;
--foreground: 210 40% 96%;
--card: 222 47% 10%;
--card-foreground: 210 40% 96%;
--popover: 222 47% 10%;
--popover-foreground: 210 40% 96%;
--primary: 215 52% 45%;
--primary-foreground: 210 40% 98%;
--secondary: 217 33% 17%;
--secondary-foreground: 210 40% 96%;
--muted: 217 33% 17%;
--muted-foreground: 215 20% 65%;
--accent: 217 33% 17%;
--accent-foreground: 210 40% 96%;
--destructive: 0 63% 31%;
--destructive-foreground: 210 40% 96%;
--border: 217 33% 20%;
--input: 217 33% 20%;
--ring: 215 52% 45%;
```

### 37.2 Sidebar Tokens

```css
/* Light Sidebar */
--sidebar-background: 215 52% 18%;
--sidebar-foreground: 210 40% 96%;
--sidebar-primary: 210 40% 98%;
--sidebar-primary-foreground: 215 52% 18%;
--sidebar-accent: 215 40% 25%;
--sidebar-accent-foreground: 210 40% 96%;
--sidebar-border: 215 30% 28%;
--sidebar-ring: 210 40% 70%;

/* Dark Sidebar */
--sidebar-background: 222 47% 8%;
--sidebar-foreground: 210 40% 90%;
--sidebar-primary: 210 40% 96%;
--sidebar-primary-foreground: 222 47% 10%;
--sidebar-accent: 217 33% 16%;
--sidebar-accent-foreground: 210 40% 90%;
--sidebar-border: 217 33% 18%;
--sidebar-ring: 210 40% 70%;
```

### 37.3 Typography Tokens

```css
/* Font Families */
font-family: "Cairo", "Tajawal", system-ui, -apple-system, sans-serif;

/* Font Sizes — Default Scale */
--scale-font-xs: 0.75rem;    /* 12px */
--scale-font-sm: 0.875rem;   /* 14px */
--scale-font-base: 0.875rem; /* 14px */
--scale-font-lg: 1.125rem;   /* 18px */
--scale-font-xl: 1.25rem;    /* 20px */
--scale-font-2xl: 1.5rem;    /* 24px */
--scale-font-3xl: 2rem;      /* 32px */

/* Extra Small Sizes */
font-size: 0.625rem;  /* 2xs: 10px */
font-size: 0.5625rem; /* 3xs: 9px */
font-size: 0.5rem;    /* 4xs: 8px */
```

### 37.4 Spacing Tokens (Density-Driven)

```css
/* Density: Compact */
--density-spacing-xs: 0.125rem;  /* 2px */
--density-spacing-sm: 0.25rem;   /* 4px */
--density-spacing-md: 0.5rem;    /* 8px */
--density-spacing-lg: 0.75rem;   /* 12px */
--density-spacing-xl: 1rem;      /* 16px */
--density-font-sm: 0.6875rem;    /* 11px */
--density-font-base: 0.8125rem;  /* 13px */
--density-row-h: 2rem;           /* 32px */

/* Density: Comfortable (Default) */
--density-spacing-xs: 0.25rem;   /* 4px */
--density-spacing-sm: 0.5rem;    /* 8px */
--density-spacing-md: 0.75rem;   /* 12px */
--density-spacing-lg: 1rem;      /* 16px */
--density-spacing-xl: 1.5rem;    /* 24px */
--density-font-sm: 0.75rem;      /* 12px */
--density-font-base: 0.875rem;   /* 14px */
--density-row-h: 2.5rem;         /* 40px */

/* Density: Spacious */
--density-spacing-xs: 0.5rem;    /* 8px */
--density-spacing-sm: 0.75rem;   /* 12px */
--density-spacing-md: 1rem;      /* 16px */
--density-spacing-lg: 1.5rem;    /* 24px */
--density-spacing-xl: 2rem;      /* 32px */
--density-font-sm: 0.8125rem;    /* 13px */
--density-font-base: 0.9375rem;  /* 15px */
--density-row-h: 3rem;           /* 48px */
```

### 37.5 Shadow Tokens

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

### 37.6 Z-Index Tokens

```css
--z-base: 0;
--z-dropdown: 1000;
--z-sticky: 1020;
--z-fixed: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;
--z-toast: 1080;
```

### 37.7 Transition Tokens

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

### 37.8 Border Radius Tokens

```css
--radius: 0.5rem;     /* 8px — base */
--radius-sm: 4px;     /* calc(var(--radius) - 4px) */
--radius-md: 6px;     /* calc(var(--radius) - 2px) */
--radius-lg: 8px;     /* var(--radius) */
--radius-xl: 12px;
--radius-2xl: 16px;
--radius-3xl: 24px;
--radius-full: 9999px;
```

### 37.9 Sidebar Density Tokens

```css
/* Sidebar Density: Compact */
body.sidebar-density-compact {
  --sidebar-field-gap: 0.25rem;
  --sidebar-section-gap: 0.75rem;
  --sidebar-content-gap: 1rem;
  --sidebar-container-py: 0.75rem;
  --sidebar-container-px: 1rem;
  --sidebar-label-size: 0.65rem;
  --sidebar-field-py: 0.25rem;
}

/* Sidebar Density: Comfortable */
body.sidebar-density-comfortable {
  --sidebar-field-gap: 0.5rem;
  --sidebar-section-gap: 1rem;
  --sidebar-content-gap: 1.5rem;
  --sidebar-container-py: 1rem;
  --sidebar-container-px: 1.5rem;
  --sidebar-label-size: 0.75rem;
  --sidebar-field-py: 0.375rem;
}

/* Sidebar Density: Spacious */
body.sidebar-density-spacious {
  --sidebar-field-gap: 0.75rem;
  --sidebar-section-gap: 1.5rem;
  --sidebar-content-gap: 2rem;
  --sidebar-container-py: 1.25rem;
  --sidebar-container-px: 2rem;
  --sidebar-label-size: 0.8125rem;
  --sidebar-field-py: 0.5rem;
}
```

---

## 38. Responsive Breakpoints

### Current Implementation

| Breakpoint | Width | CSS Class | Description |
|---|---|---|---|
| `sm` | 640px | `sm:` | Small mobile |
| `md` | 768px | `md:` | Mobile |
| `lg` | 1024px | `lg:` | Tablet |
| `xl` | 1280px | `xl:` | Desktop |
| `2xl` | 1536px | `2xl:` | Large desktop |

### Structural Transformations

| Viewport | Navigation | Content | Tables | Forms | Sidebars |
|---|---|---|---|---|---|
| < 768px | Drawer/stacked | Single column | Card/list | Single column | Overlay |
| 768px - 1024px | Collapsible sidebar | 2 columns | Compact grid | 1-2 columns | Collapsible |
| > 1024px | Persistent sidebar | Multi-column | Full grid | 2 columns | Persistent |

### Settings Responsive Behavior

| Viewport | Settings Layout |
|---|---|
| < lg | Stacked: nav as Sheet/drawer |
| >= lg | Grid: sidebar 3/12 + content 9/12 |

### Table Responsive Behavior

| Viewport | Table Layout |
|---|---|
| Desktop | Full grid with all visible columns |
| Tablet | Compact grid + collapsible less-important columns |
| Mobile | Card/list representation or contained horizontal scroll |

---

## 39. Accessibility Standards

### Keyboard Navigation

- Full tab order through all interactive elements
- Arrow navigation in trees, menus, and grids
- Escape to close dialogs/popovers/drawers
- Enter/Space to activate buttons and links
- Tab to move between form fields
- Ctrl/Cmd+K for global search

### Focus Management

- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- High contrast focus indicators
- Focus restoration on dialog close
- Logical focus order matching visual layout
- Never remove focus outlines without providing alternative

### Screen Reader Support

- Semantic HTML elements (`header`, `nav`, `main`, `aside`, `footer`)
- ARIA labels for icon-only buttons (`aria-label`)
- `role` attributes where needed (`role="alert"`, `role="navigation"`)
- Live regions for dynamic content (`aria-live`)
- `sr-only` text for screen reader only content

### Color Contrast

- Minimum 4.5:1 for normal text (WCAG AA)
- Minimum 3:1 for large text (WCAG AA)
- Status indicators use more than color alone (icon + text + color)
- Focus indicators must have 3:1 contrast

### Touch Targets

- Minimum 44px for touch interactions
- Icon-only buttons require larger hit area on mobile
- Adequate spacing between interactive elements

### Reduced Motion

- Respect `prefers-reduced-motion` media query
- Disable non-essential transitions when motion mode is `reduced`
- Keep essential state change feedback without motion dependence

---

## 40. RTL/LTR Implementation

### Default Direction

- RTL is the default: `html { direction: rtl; }`
- English LTR must remain first-class

### Logical Properties — Use These

```css
/* Margins */
margin-inline-start / margin-inline-end

/* Padding */
padding-inline-start / padding-inline-end

/* Borders */
border-inline-start / border-inline-end

/* Positioning */
inset-inline-start / inset-inline-end

/* Text */
text-align: start / end
```

### Physical Properties — Avoid These (Unless Explicitly Physical)

```css
margin-left / margin-right
padding-left / padding-right
border-left / border-right
left / right
text-align: left / right
```

### Tailwind Logical Classes

| Use | Avoid |
|---|---|
| `ms-*` (margin-inline-start) | `ml-*` |
| `me-*` (margin-inline-end) | `mr-*` |
| `ps-*` (padding-inline-start) | `pl-*` |
| `pe-*` (padding-inline-end) | `pr-*` |
| `text-start` | `text-left` |
| `text-end` | `text-right` |
| `border-s` | `border-l` |
| `border-e` | `border-r` |
| `start-*` | `left-*` |
| `end-*` | `right-*` |

### Icon Mirroring

**Mirror in RTL:**
- Navigation arrows (chevron-left/right, arrow-left/right)
- Back/forward icons
- Directional indicators

**Do NOT mirror:**
- Search icons
- Settings/gear icons
- Edit/pencil icons
- Delete/trash icons
- Save/disk icons
- Currency icons
- Status icons (check, alert, info)

### Custom RTL Helpers (index.css)

```css
.flip-rtl { transform: scaleX(-1); }  /* Manual icon flip */
```

---

## 41. Component State Standards

### Interactive States

| State | Visual Change | Use Case |
|---|---|---|
| Default | Base appearance | Initial state |
| Hover | Background/border change | Mouse hover |
| Focus | Ring/outline | Keyboard navigation |
| Active/Pressed | Darker background | Click/press |
| Selected | Primary background | Selected item |
| Disabled | Reduced opacity (50%) | Unavailable action |
| Loading | Spinner/animation | Processing |

### Status States

| State | Color Token | Visual | Use Case |
|---|---|---|---|
| Success | green-50/bg-green-50 | Check icon | Completed action |
| Warning | amber-50/bg-amber-50 | Alert icon | Attention needed |
| Error | red-50/bg-red-50 | X circle icon | Failed action |
| Info | blue-50/bg-blue-50 | Info icon | Information |

### StatusBadge Tone Mapping

| Status | Tone |
|---|---|
| Draft | amber |
| Saved | blue |
| Validated | blue |
| Approved | emerald |
| Posted | green |
| Locked | slate |
| Cancelled | red |
| PartiallyPaid | orange |
| FullyPaid | emerald |
| InProgress | blue |
| Completed | green |
| Open | green |
| Closing | amber |
| Reopened | blue |
| Closed | slate |

### Loading Patterns

| Pattern | Usage |
|---|---|
| Skeleton | Predictable content regions (cards, tables, lists) |
| Spinner | Short operations (button submit, save) |
| Progress bar | Known-duration operations |
| Full-page spinner | Initial page load |

### Empty State Pattern

```
icon/illustration → primary message → optional suggestion → clear next action
```

### Error State Pattern

```
error icon → what failed → why (if known) → retry action (if available)
```

---

## 42. Data Visualization Standards

### Chart Colors

```typescript
const CHART_COLORS = [
  "#2563eb", // blue (revenue)
  "#10b981", // emerald (positive)
  "#f59e0b", // amber (warning)
  "#64748b", // slate (neutral)
  "#8b5cf6", // violet
  "#ec4899", // pink
];
```

### Financial Chart Rules

- Use semantic theme palette
- Remain readable in both light and dark themes
- Decoration must never overpower financial values
- Use tabular numerals for axis labels
- Provide clear legends
- Use `Recharts` ResponsiveContainer for responsive charts

### Dashboard KPI Hierarchy

```
identity → KPIs → major trends/warnings → supporting charts/tables
```

---

## 43. Print Styles

```css
@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  .print-area { padding: 2rem; }
  .print-clean {
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    overflow: visible !important;
    transition: none !important;
  }
  .print-clean-parent {
    padding: 0 !important;
    gap: 0 !important;
    overflow: visible !important;
  }
  .print-collapsed {
    max-width: 50px !important;
    min-width: 50px !important;
    width: 50px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    font-size: 0.55rem !important;
    padding: 2px !important;
  }
}
```

---

## 44. Scrollbar Styling

```css
/* Global scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Sidebar scrollbar — hidden by default, shows on hover */
.sidebar-scrollbar::-webkit-scrollbar { width: 6px; }
.sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
.sidebar-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; }
.sidebar-root:hover .sidebar-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); }
```

---

## 45. Settings — Appearance Section Complete Reference

### Settings Navigation Structure

```
Settings
├── الشركة (Company)
├── البادئات (Prefixes)
├── العملات (Currencies)
├── المالية (Financial)
├── المستودعات (Warehouses)
├── اللغة والمنطقة (Localization)
├── التصدير (Export)
├── النسخ الاحتياطي (Backups)
├── الأمان (Security)
├── حول (About)
└── المظهر (Appearance)
    ├── الجداول (Tables)
    ├── شريط التنقل (Navbar)
    ├── محتوى الشريط الجانبي (Sidebar Content)
    ├── اللوحة الجانبية (Panel)
    └── المظهر (Appearance)
        ├── تخطيط التطبيق (Layout Builder)
        ├── السمات (Themes)
        ├── وضع الألوان (Color Mode)
        ├── اللون الأساسي (Primary Color)
        ├── الكثافة (Density)
        ├── مقياس الواجهة (UI Scale)
        ├── نمط التبويبات والحركة (Tabs & Motion)
        ├── إظهار/إخفاء (Show/Hide)
        └── تجاوزات الشريط الجانبي (Sidebar Overrides)
```

### Layout Builder Options

1. **قائمة التنقل** (Navigation Menu): سيناف / توبناف / كومبو
2. **شكل العمودي** (Sidenav Shape): كامل / مكدس
3. **مظهر العمودي** (Sidenav Appearance): فاتح / داكن
4. **شكل الأفقي** (Topnav Shape): كامل / نحيف / مكدس
5. **مظهر الأفقي** (Topnav Appearance): فاتح / داكن

### Theme Selection Grid

- Grid layout: 2 cols mobile, 3 cols sm, 5 cols lg
- Each theme shows: color preview strip + checkmark if active + name
- Color preview: background | sidebar | primary | accent strips

### Primary Color Picker

- 12 color circles in a flex-wrap row
- Active: ring-2 + scale-110 + check icon
- Hover: scale-105

### Density Picker

- 3 option cards in a flex row
- Each shows: bar visualization + label + description
- Active: border-primary + bg-primary/5

### UI Scale Picker

- 3 option cards in a flex row
- Each shows: "Aa" text at scaled size + label + description
- Active: border-primary + bg-primary/5

### Tabs & Motion

- Grid: 2 cols
- Tab Style: default / browser / vscode
- Motion: full / reduced

### Show/Hide Toggles

- ToggleRow component: label + description + Switch
- Items: sidebar, topBar, search, notifications, breadcrumbs

### Sidebar Overrides

- ToggleRow items: collapsed, groupHeaders, icons
- Background picker: 5 color buttons with labels