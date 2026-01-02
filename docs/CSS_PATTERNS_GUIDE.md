# CSS Patterns Guide

This document captures CSS patterns and solutions used throughout the Nexus application. These are reusable patterns that solve common layout and styling challenges.

For theme colors, CSS variables, and `PAGE_STYLES` constants, see [INDUSTRIAL_STYLING_GUIDE.md](./INDUSTRIAL_STYLING_GUIDE.md).

## Table of Contents
1. [Infinite Background on Horizontal Scroll](#infinite-background-on-horizontal-scroll)
2. [GPU Rendering Fixes](#gpu-rendering-fixes)
3. [Scrollbar Reservation](#scrollbar-reservation)

---

## Infinite Background on Horizontal Scroll

### Problem
When content has a minimum width larger than the viewport (e.g., `min-width: 1100px`), horizontal scrolling reveals white space instead of the page background color.

### Solution
Apply `min-width: fit-content` to the container that has the background color. This ensures the background-colored element expands to match the full scrollable content width.

```css
/* Container with background color */
.page-container {
  min-height: 100vh;
  background-color: var(--theme-page-bg);
  min-width: fit-content; /* Extends background to full content width */
}
```

### Example Implementation
```css
/* From JobEstimation.css */
.job-estimation-builder-mode {
  min-width: fit-content;
}
```

### When to Use
- Pages with wide tables or grids that require horizontal scrolling on smaller screens
- Any page where content has a `min-width` that may exceed viewport width

---

## GPU Rendering Fixes

### Problem
CSS Grid with percentage-based columns can cause diagonal white lines due to subpixel rendering issues in GPU acceleration.

### Solution
Force GPU layer composition with backface-visibility hack:

```css
.grid-container {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
}
```

### Example Implementation
```css
/* From JobEstimation.css */
.estimate-builder-layout-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 1100px;
  /* Fix GPU rendering artifacts */
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
}
```

### When to Use
- Grid layouts with percentage-based widths
- Complex flex layouts with many nested elements
- Any layout showing thin diagonal lines or rendering artifacts

---

## Scrollbar Reservation

### Problem
When content changes cause a scrollbar to appear/disappear, it shifts the layout horizontally, causing visual jitter.

### Solution
Reserve space for the scrollbar on the body element:

```css
body:has(.scrollable-page) {
  overflow-y: scroll;
}
```

### Example Implementation
```css
/* From JobEstimation.css */
body:has(.job-estimation-builder-mode) {
  overflow-y: scroll;
}
```

### When to Use
- Pages where dynamic content may cause scrollbar to appear/disappear
- Modal-heavy pages where background content length varies
- Any page where layout shift from scrollbar is noticeable

---

## Best Practices

1. **Document new patterns** - When solving a CSS challenge, add it to this guide
2. **Use CSS variables** - Prefer theme variables over hardcoded colors (see [INDUSTRIAL_STYLING_GUIDE.md](./INDUSTRIAL_STYLING_GUIDE.md))
3. **Test at multiple viewport sizes** - Especially for scroll-related patterns
4. **Consider mobile** - Patterns should work across device sizes
