# Grayscale Styling Guide

This document describes the grayscale color scheme and theming system used in the Job Estimation page. The system uses CSS variables for easy theme switching and centralized PAGE_STYLES constants for type-safe usage.

## Theme System Overview

The theming system consists of:
1. **CSS Variables** defined in `JobEstimation.css` - control actual colors
2. **PAGE_STYLES** constants in `moduleColors.ts` - Tailwind classes that reference CSS variables
3. **Theme switching** via `data-theme` attribute on the document root

### Current Themes
- **industrial** (default) - Current grayscale look with dark page background
- **light** (placeholder) - Light theme for future use

### Switching Themes
```javascript
// Switch to light theme
document.documentElement.dataset.theme = 'light';

// Switch back to industrial (or remove attribute for default)
document.documentElement.dataset.theme = 'industrial';
```

## Color Hierarchy

The grayscale palette creates visual depth through layering:

| Element | CSS Variable | Hex Value | Purpose |
|---------|-------------|-----------|---------|
| Page Background | `--theme-page-bg` | `#6b7280` | Base layer - darkest |
| Panels/Cards | `--theme-panel-bg` | `#d1d5db` | Content containers |
| Table Headers | `--theme-header-bg` | `#9ca3af` | Section headers within panels |
| Search Inputs | `--theme-input-bg` | `#b5bdc6` | Custom gray-350 |
| Borders | `--theme-border` | `#6b7280` | Matches page background for cohesion |

## Visual Hierarchy (Dark to Light)

```
Page Background (--theme-page-bg) ─── Darkest
    │
    └── Panel (--theme-panel-bg)
            │
            ├── Table Header (--theme-header-bg)
            │
            ├── Input (--theme-input-bg)
            │
            └── Content Areas (--theme-hover-bg on hover)
```

## Usage Examples

### Using PAGE_STYLES (Recommended)

Always import and use PAGE_STYLES for theme-aware styling:

```tsx
import { PAGE_STYLES } from '../../constants/moduleColors';

// Full page with background
<div className={PAGE_STYLES.fullPage}>
  {/* Content */}
</div>

// Panel container (common composite)
<div className={PAGE_STYLES.composites.panelContainer}>
  {/* Panel content */}
</div>

// Table header
<thead className={PAGE_STYLES.composites.tableHeader}>
  <tr>
    <th className={PAGE_STYLES.header.text}>Column</th>
  </tr>
</thead>

// Table body with dividers
<tbody className={PAGE_STYLES.composites.tableBody}>
  {/* Table rows */}
</tbody>

// Nav bar
<nav className={`${PAGE_STYLES.composites.navBar} px-4 py-4`}>
  {/* Navigation content */}
</nav>
```

### PAGE_STYLES Reference

```typescript
PAGE_STYLES = {
  // Legacy properties (backwards compatibility)
  background: 'bg-[var(--theme-page-bg)]',
  fullPage: 'min-h-screen bg-[var(--theme-page-bg)]',
  border: 'border-[var(--theme-border)]',
  divider: 'divide-[var(--theme-border)]',

  // Page level
  page: {
    background: 'bg-[var(--theme-page-bg)]',
    text: 'text-[var(--theme-text-on-dark)]',
  },

  // Panel level (cards, containers)
  panel: {
    background: 'bg-[var(--theme-panel-bg)]',
    text: 'text-[var(--theme-text-primary)]',
    textMuted: 'text-[var(--theme-text-muted)]',
    textSecondary: 'text-[var(--theme-text-secondary)]',
    border: 'border-[var(--theme-border)]',
    divider: 'divide-[var(--theme-border)]',
  },

  // Header level (table headers, panel headers)
  header: {
    background: 'bg-[var(--theme-header-bg)]',
    text: 'text-[var(--theme-text-secondary)]',
    border: 'border-[var(--theme-border)]',
  },

  // Input fields
  input: {
    background: 'bg-[var(--theme-input-bg)]',
    text: 'text-[var(--theme-text-primary)]',
    placeholder: 'placeholder:text-[var(--theme-text-muted)]',
    border: 'border-[var(--theme-border)]',
  },

  // Interactive states
  interactive: {
    hover: 'hover:bg-[var(--theme-hover-bg)]',
    hoverOnHeader: 'hover:bg-[var(--theme-header-hover)]',
    selected: 'bg-[var(--theme-selected-bg)]',
  },

  // Composite classes (common combinations)
  composites: {
    panelContainer: 'bg-[var(--theme-panel-bg)] rounded-lg shadow border border-[var(--theme-border)]',
    tableHeader: 'bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)]',
    tableBody: 'divide-y divide-[var(--theme-border)]',
    navBar: 'bg-[var(--theme-panel-bg)] border-b border-[var(--theme-border)]',
  },
}
```

### Text Colors

| Element | PAGE_STYLES Property | Usage |
|---------|---------------------|-------|
| Headers | `PAGE_STYLES.panel.text` | Panel titles, primary text |
| Body Text | `PAGE_STYLES.header.text` | Table headers, descriptions |
| Secondary | `PAGE_STYLES.panel.textSecondary` | Labels, helper text |
| Muted | `PAGE_STYLES.panel.textMuted` | Timestamps, placeholders |
| On Dark BG | `PAGE_STYLES.page.text` | Text on page background |

## CSS Variables Reference

All CSS variables are defined in `JobEstimation.css`:

```css
:root,
[data-theme="industrial"] {
  /* Page level */
  --theme-page-bg: #6b7280;
  --theme-text-on-dark: #f3f4f6;

  /* Panel level */
  --theme-panel-bg: #d1d5db;
  --theme-panel-gradient-start: #d1d5db;
  --theme-panel-gradient-end: #9ca3af;

  /* Header level */
  --theme-header-bg: #9ca3af;
  --theme-header-hover: #6b7280;

  /* Input fields */
  --theme-input-bg: #b5bdc6;

  /* Borders */
  --theme-border: #6b7280;

  /* Text colors */
  --theme-text-primary: #111827;
  --theme-text-secondary: #374151;
  --theme-text-muted: #6b7280;

  /* Interactive states */
  --theme-hover-bg: #f9fafb;
  --theme-selected-bg: #f9fafb;

  /* Scrollbar */
  --theme-scrollbar-track: #f3f4f6;
  --theme-scrollbar-thumb: #9ca3af;
  --theme-scrollbar-thumb-hover: #6b7280;
}
```

## GPU Rendering Fix (Diagonal Lines)

When using CSS Grid with percentage-based columns, GPU rendering can cause diagonal white lines. Apply this fix:

```css
.grid-container {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
}
```

## Accent Colors

For interactive elements (buttons, badges, selection states), use the module-specific colors from `MODULE_COLORS` in `moduleColors.ts`. The grayscale palette is specifically for structural/background elements.

## Best Practices

1. **Always use PAGE_STYLES** - Never hardcode gray colors; use the theme constants
2. **Import from moduleColors** - `import { PAGE_STYLES } from '../../constants/moduleColors'`
3. **Use composites for common patterns** - `PAGE_STYLES.composites.panelContainer` etc.
4. **Use semantic names** - Choose the appropriate level (page, panel, header, input)
5. **Transitions** - Add `transition-all` or `transition-colors` for smooth hover effects
6. **GPU Fix** - Apply backface-visibility fix proactively to grid containers

## Migration from Hardcoded Classes

When updating existing code:

| Old Pattern | New Pattern |
|-------------|-------------|
| `bg-gray-300 rounded-lg shadow border border-gray-500` | `PAGE_STYLES.composites.panelContainer` |
| `bg-gray-400 border-b border-gray-500` | `PAGE_STYLES.composites.tableHeader` |
| `text-gray-900` | `PAGE_STYLES.panel.text` |
| `text-gray-600` or `text-gray-500` | `PAGE_STYLES.panel.textMuted` |
| `text-gray-700` | `PAGE_STYLES.header.text` |
| `hover:bg-gray-50` | `PAGE_STYLES.interactive.hover` |
| `divide-y divide-gray-500` | `PAGE_STYLES.composites.tableBody` |
