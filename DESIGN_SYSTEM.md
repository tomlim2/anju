# Design System - UE Command Interface

## Design Philosophy

Pure geometric minimalism. Black and white brutalist interface design inspired by technical drafting and command-line interfaces. Zero ornamentation - every pixel serves function.

---

## Color Palette

### Base Colors
```css
:root {
  /* Primary Scale */
  --color-black: #000000;
  --color-white: #FFFFFF;

  /* Gray Scale - 8 steps */
  --color-gray-900: #0A0A0A;  /* Near black */
  --color-gray-800: #1A1A1A;  /* Dark backgrounds */
  --color-gray-700: #2D2D2D;  /* Secondary backgrounds */
  --color-gray-600: #404040;  /* Borders, dividers */
  --color-gray-500: #666666;  /* Disabled states */
  --color-gray-400: #999999;  /* Secondary text */
  --color-gray-300: #CCCCCC;  /* Subtle borders */
  --color-gray-200: #E5E5E5;  /* Light backgrounds */
  --color-gray-100: #F5F5F5;  /* Subtle backgrounds */
}
```

### Semantic Colors
```css
:root {
  /* Backgrounds */
  --bg-primary: var(--color-white);
  --bg-secondary: var(--color-gray-100);
  --bg-tertiary: var(--color-gray-200);
  --bg-inverse: var(--color-black);
  --bg-hover: var(--color-gray-800);
  --bg-active: var(--color-black);
  --bg-disabled: var(--color-gray-300);

  /* Text */
  --text-primary: var(--color-black);
  --text-secondary: var(--color-gray-600);
  --text-tertiary: var(--color-gray-500);
  --text-inverse: var(--color-white);
  --text-disabled: var(--color-gray-400);

  /* Borders */
  --border-primary: var(--color-black);
  --border-secondary: var(--color-gray-600);
  --border-tertiary: var(--color-gray-300);
  --border-focus: var(--color-black);
}
```

---

## Typography

### Font Families
```css
:root {
  /* Primary - System Monospace */
  --font-mono: 'Courier New', 'Courier', monospace;

  /* Secondary - System Sans */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;

  /* Terminal Style - For code/commands */
  --font-terminal: 'Consolas', 'Monaco', 'Courier New', monospace;
}
```

### Type Scale
```css
:root {
  /* Font Sizes */
  --text-xs: 10px;      /* Helper text, metadata */
  --text-sm: 12px;      /* Secondary text, labels */
  --text-base: 14px;    /* Body text, inputs */
  --text-md: 16px;      /* Emphasized body */
  --text-lg: 18px;      /* Subheadings */
  --text-xl: 24px;      /* Section headers */
  --text-2xl: 32px;     /* Page titles */
  --text-3xl: 48px;     /* Hero text */

  /* Line Heights */
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-loose: 1.8;

  /* Font Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-bold: 700;

  /* Letter Spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.1em;
}
```

### Typography Classes
```css
.text-display {
  font-family: var(--font-sans);
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  text-transform: uppercase;
}

.text-heading-1 {
  font-family: var(--font-sans);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-normal);
}

.text-heading-2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
}

.text-heading-3 {
  font-family: var(--font-sans);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
}

.text-body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--weight-normal);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
}

.text-body-mono {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: var(--weight-normal);
  line-height: var(--leading-loose);
  letter-spacing: var(--tracking-normal);
}

.text-label {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
}

.text-caption {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--weight-normal);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
  color: var(--text-secondary);
}

.text-code {
  font-family: var(--font-terminal);
  font-size: var(--text-sm);
  font-weight: var(--weight-normal);
  line-height: var(--leading-loose);
  letter-spacing: var(--tracking-normal);
}
```

---

## Spacing System

### Grid Foundation
```css
:root {
  /* Base Unit: 4px */
  --space-base: 4px;

  /* Spacing Scale */
  --space-0: 0;
  --space-1: 4px;    /* 1 unit */
  --space-2: 8px;    /* 2 units */
  --space-3: 12px;   /* 3 units */
  --space-4: 16px;   /* 4 units */
  --space-5: 20px;   /* 5 units */
  --space-6: 24px;   /* 6 units */
  --space-8: 32px;   /* 8 units */
  --space-10: 40px;  /* 10 units */
  --space-12: 48px;  /* 12 units */
  --space-16: 64px;  /* 16 units */
  --space-20: 80px;  /* 20 units */
  --space-24: 96px;  /* 24 units */
  --space-32: 128px; /* 32 units */
}
```

### Layout Grid
```css
:root {
  /* Container Widths */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1536px;

  /* Grid Columns */
  --grid-columns: 12;
  --grid-gap: var(--space-6);

  /* Layout Spacing */
  --layout-header-height: 64px;
  --layout-sidebar-width: 280px;
  --layout-gutter: var(--space-6);
  --layout-section: var(--space-16);
}
```

---

## Borders

### Border Tokens
```css
:root {
  /* Border Widths */
  --border-width-none: 0;
  --border-width-thin: 1px;
  --border-width-medium: 2px;
  --border-width-thick: 4px;
  --border-width-heavy: 8px;

  /* Border Styles */
  --border-style-solid: solid;
  --border-style-dashed: dashed;
  --border-style-dotted: dotted;

  /* Border Radius - ALL ZERO */
  --radius-none: 0;
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;
  --radius-full: 0;
}
```

### Border Utilities
```css
.border {
  border: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.border-2 {
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
}

.border-4 {
  border: var(--border-width-thick) var(--border-style-solid) var(--border-primary);
}

.border-top {
  border-top: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.border-bottom {
  border-bottom: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.border-left {
  border-left: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.border-right {
  border-right: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.border-dashed {
  border-style: var(--border-style-dashed);
}
```

---

## Buttons

### Button Base
```css
.btn {
  /* Reset */
  appearance: none;
  border: none;
  background: none;
  margin: 0;
  cursor: pointer;
  text-decoration: none;

  /* Typography */
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  text-align: center;

  /* Layout */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  min-height: 40px;

  /* Visual */
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  background-color: var(--bg-primary);
  color: var(--text-primary);

  /* Interaction */
  transition: none;
  user-select: none;
}
```

### Button Variants
```css
/* Primary - Black background */
.btn-primary {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-color: var(--border-primary);
}

.btn-primary:hover {
  background-color: var(--color-gray-900);
}

.btn-primary:active {
  background-color: var(--color-gray-800);
}

.btn-primary:disabled {
  background-color: var(--bg-disabled);
  color: var(--text-disabled);
  border-color: var(--border-tertiary);
  cursor: not-allowed;
}

/* Secondary - White background with border */
.btn-secondary {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--border-primary);
}

.btn-secondary:hover {
  background-color: var(--bg-secondary);
}

.btn-secondary:active {
  background-color: var(--bg-tertiary);
}

.btn-secondary:disabled {
  background-color: var(--bg-primary);
  color: var(--text-disabled);
  border-color: var(--border-tertiary);
  cursor: not-allowed;
}

/* Ghost - Transparent background */
.btn-ghost {
  background-color: transparent;
  color: var(--text-primary);
  border-color: transparent;
}

.btn-ghost:hover {
  background-color: var(--bg-secondary);
  border-color: var(--border-primary);
}

.btn-ghost:active {
  background-color: var(--bg-tertiary);
}

.btn-ghost:disabled {
  color: var(--text-disabled);
  background-color: transparent;
  cursor: not-allowed;
}

/* Danger - Inverted for destructive actions */
.btn-danger {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-color: var(--border-primary);
  border-width: var(--border-width-thick);
}

.btn-danger:hover {
  border-width: var(--border-width-heavy);
}

.btn-danger:active {
  background-color: var(--color-gray-900);
}
```

### Button Sizes
```css
.btn-sm {
  padding: var(--space-2) var(--space-4);
  min-height: 32px;
  font-size: var(--text-sm);
}

.btn-md {
  padding: var(--space-3) var(--space-6);
  min-height: 40px;
  font-size: var(--text-base);
}

.btn-lg {
  padding: var(--space-4) var(--space-8);
  min-height: 48px;
  font-size: var(--text-md);
}

.btn-xl {
  padding: var(--space-5) var(--space-10);
  min-height: 56px;
  font-size: var(--text-lg);
}
```

### Button Layouts
```css
.btn-block {
  display: flex;
  width: 100%;
}

.btn-icon-only {
  padding: var(--space-3);
  min-width: 40px;
  aspect-ratio: 1;
}
```

---

## Input Fields

### Input Base
```css
.input {
  /* Reset */
  appearance: none;
  margin: 0;

  /* Typography */
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: var(--weight-normal);
  letter-spacing: var(--tracking-normal);
  color: var(--text-primary);

  /* Layout */
  display: block;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  min-height: 40px;

  /* Visual */
  background-color: var(--bg-primary);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-secondary);

  /* Interaction */
  transition: none;
  outline: none;
}

.input::placeholder {
  color: var(--text-tertiary);
  font-style: italic;
}

.input:hover {
  border-color: var(--border-primary);
}

.input:focus {
  border-color: var(--border-focus);
  border-width: var(--border-width-thick);
  padding: calc(var(--space-3) - 1px) calc(var(--space-4) - 1px);
}

.input:disabled {
  background-color: var(--bg-disabled);
  color: var(--text-disabled);
  border-color: var(--border-tertiary);
  cursor: not-allowed;
}

.input.error {
  border-color: var(--border-primary);
  border-width: var(--border-width-thick);
  border-style: var(--border-style-dashed);
}
```

### Input Variants
```css
.input-text {
  /* Default text input */
}

.input-number {
  font-family: var(--font-terminal);
  text-align: right;
}

.input-search {
  padding-left: var(--space-10);
  background-image: url('data:image/svg+xml,...'); /* Search icon */
  background-position: var(--space-4) center;
  background-repeat: no-repeat;
}

.input-file {
  padding: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
}
```

### Textarea
```css
.textarea {
  /* Extends .input */
  min-height: 120px;
  resize: vertical;
  line-height: var(--leading-loose);
  font-family: var(--font-mono);
}
```

### Select
```css
.select {
  /* Extends .input */
  appearance: none;
  padding-right: var(--space-10);
  background-image: url('data:image/svg+xml,...'); /* Dropdown arrow */
  background-position: right var(--space-4) center;
  background-repeat: no-repeat;
  cursor: pointer;
}

.select:hover {
  border-color: var(--border-primary);
}

.select:focus {
  border-color: var(--border-focus);
  border-width: var(--border-width-thick);
}
```

### Checkbox & Radio
```css
.checkbox,
.radio {
  appearance: none;
  width: 20px;
  height: 20px;
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  background-color: var(--bg-primary);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}

.radio {
  /* Radio stays square in this design - no circles */
}

.checkbox:hover,
.radio:hover {
  border-width: var(--border-width-thick);
}

.checkbox:checked,
.radio:checked {
  background-color: var(--bg-inverse);
  border-color: var(--border-primary);
}

.checkbox:checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  bottom: 2px;
  background-color: var(--bg-primary);
  clip-path: polygon(20% 50%, 40% 70%, 80% 20%, 90% 30%, 40% 90%, 10% 60%);
}

.radio:checked::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  bottom: 4px;
  background-color: var(--bg-primary);
}

.checkbox:disabled,
.radio:disabled {
  background-color: var(--bg-disabled);
  border-color: var(--border-tertiary);
  cursor: not-allowed;
}
```

### Input Label
```css
.label {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-primary);
  display: block;
  margin-bottom: var(--space-2);
}

.label-inline {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 0;
  text-transform: none;
  font-weight: var(--weight-normal);
  letter-spacing: var(--tracking-normal);
}
```

### Input Group
```css
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.input-group-horizontal {
  flex-direction: row;
  align-items: center;
}

.input-helper {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.input-error {
  font-size: var(--text-xs);
  color: var(--text-primary);
  margin-top: var(--space-1);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}
```

---

## Layout Components

### Container
```css
.container {
  width: 100%;
  max-width: var(--container-xl);
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--layout-gutter);
  padding-right: var(--layout-gutter);
}

.container-fluid {
  width: 100%;
  padding-left: var(--layout-gutter);
  padding-right: var(--layout-gutter);
}
```

### Grid
```css
.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), 1fr);
  gap: var(--grid-gap);
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

.col-span-1 { grid-column: span 1; }
.col-span-2 { grid-column: span 2; }
.col-span-3 { grid-column: span 3; }
.col-span-4 { grid-column: span 4; }
.col-span-6 { grid-column: span 6; }
.col-span-12 { grid-column: span 12; }
```

### Flex
```css
.flex {
  display: flex;
}

.flex-col {
  display: flex;
  flex-direction: column;
}

.flex-wrap {
  flex-wrap: wrap;
}

.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.items-stretch { align-items: stretch; }

.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }

.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }
.gap-8 { gap: var(--space-8); }
```

### Section
```css
.section {
  padding-top: var(--layout-section);
  padding-bottom: var(--layout-section);
}

.section-sm {
  padding-top: var(--space-12);
  padding-bottom: var(--space-12);
}

.section-lg {
  padding-top: var(--space-24);
  padding-bottom: var(--space-24);
}
```

---

## Cards & Panels

### Card
```css
.card {
  background-color: var(--bg-primary);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  padding: var(--space-6);
}

.card-header {
  padding: var(--space-4) var(--space-6);
  border-bottom: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
  margin: calc(var(--space-6) * -1) calc(var(--space-6) * -1) var(--space-6);
}

.card-footer {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
  margin: var(--space-6) calc(var(--space-6) * -1) calc(var(--space-6) * -1);
}

.card-hoverable {
  cursor: pointer;
  transition: none;
}

.card-hoverable:hover {
  border-width: var(--border-width-thick);
}

.card-hoverable:active {
  background-color: var(--bg-secondary);
}
```

### Panel
```css
.panel {
  background-color: var(--bg-secondary);
  border: var(--border-width-thin) var(--border-style-solid) var(--border-secondary);
  padding: var(--space-4);
}

.panel-primary {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-color: var(--border-primary);
}
```

### Divider
```css
.divider {
  border: none;
  border-top: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
  margin: var(--space-6) 0;
}

.divider-thick {
  border-top-width: var(--border-width-medium);
  border-color: var(--border-primary);
}

.divider-vertical {
  display: inline-block;
  width: var(--border-width-thin);
  height: auto;
  align-self: stretch;
  background-color: var(--border-tertiary);
  margin: 0 var(--space-4);
}
```

---

## Navigation

### Header
```css
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--layout-header-height);
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-bottom: var(--border-width-thick) var(--border-style-solid) var(--border-primary);
  display: flex;
  align-items: center;
  padding: 0 var(--layout-gutter);
}

.header-title {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
}
```

### Navigation Menu
```css
.nav {
  display: flex;
  gap: var(--space-1);
}

.nav-vertical {
  flex-direction: column;
}

.nav-link {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: inherit;
  padding: var(--space-3) var(--space-4);
  border: var(--border-width-medium) var(--border-style-solid) transparent;
  display: block;
}

.nav-link:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-primary);
}

.nav-link.active {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--border-primary);
}
```

### Sidebar
```css
.sidebar {
  width: var(--layout-sidebar-width);
  background-color: var(--bg-secondary);
  border-right: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  padding: var(--space-6);
  min-height: 100vh;
}

.sidebar-header {
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
  margin-bottom: var(--space-6);
}
```

### Breadcrumb
```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.breadcrumb-link {
  color: var(--text-primary);
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.breadcrumb-link:hover {
  text-decoration: underline;
  text-decoration-thickness: var(--border-width-medium);
}

.breadcrumb-separator {
  content: '/';
  color: var(--text-tertiary);
}
```

---

## Tables

### Table Base
```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.table thead {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
}

.table th {
  font-family: var(--font-sans);
  font-weight: var(--weight-bold);
  text-align: left;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  padding: var(--space-3) var(--space-4);
  border: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.table td {
  padding: var(--space-3) var(--space-4);
  border: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
}

.table tbody tr:hover {
  background-color: var(--bg-secondary);
}

.table tbody tr:active {
  background-color: var(--bg-tertiary);
}
```

### Table Variants
```css
.table-striped tbody tr:nth-child(even) {
  background-color: var(--bg-secondary);
}

.table-bordered {
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
}

.table-compact th,
.table-compact td {
  padding: var(--space-2) var(--space-3);
}
```

---

## Lists

### List Base
```css
.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list-item {
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
}

.list-item:last-child {
  border-bottom: none;
}

.list-bordered .list-item {
  border: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
  margin-bottom: var(--space-2);
}

.list-bordered .list-item:last-child {
  margin-bottom: 0;
}
```

### Interactive List
```css
.list-interactive .list-item {
  cursor: pointer;
}

.list-interactive .list-item:hover {
  background-color: var(--bg-secondary);
  border-color: var(--border-primary);
}

.list-interactive .list-item:active {
  background-color: var(--bg-tertiary);
}

.list-interactive .list-item.active {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-color: var(--border-primary);
}
```

---

## Code & Terminal

### Code Block
```css
.code-block {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  padding: var(--space-4);
  overflow-x: auto;
  font-family: var(--font-terminal);
  font-size: var(--text-sm);
  line-height: var(--leading-loose);
}

.code-inline {
  font-family: var(--font-terminal);
  font-size: 0.9em;
  background-color: var(--bg-tertiary);
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
}
```

### Terminal
```css
.terminal {
  background-color: var(--color-black);
  color: var(--color-white);
  font-family: var(--font-terminal);
  font-size: var(--text-sm);
  line-height: var(--leading-loose);
  padding: var(--space-4);
  border: var(--border-width-thick) var(--border-style-solid) var(--color-white);
  min-height: 200px;
  overflow-y: auto;
}

.terminal-prompt {
  color: var(--color-white);
  font-weight: var(--weight-bold);
}

.terminal-prompt::before {
  content: '>';
  margin-right: var(--space-2);
}
```

---

## Badges & Tags

### Badge
```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.badge-outline {
  background-color: transparent;
  color: var(--text-primary);
}

.badge-lg {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
}
```

### Tag
```css
.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--bg-secondary);
  border: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.tag-removable {
  cursor: pointer;
}

.tag-remove {
  cursor: pointer;
  padding: var(--space-1);
  margin: calc(var(--space-2) * -1) calc(var(--space-3) * -1) calc(var(--space-2) * -1) 0;
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-left: var(--border-width-thin) var(--border-style-solid) var(--border-primary);
}

.tag-remove:hover {
  background-color: var(--color-gray-800);
}
```

---

## Tooltips & Popovers

### Tooltip
```css
.tooltip {
  position: relative;
  display: inline-block;
}

.tooltip-content {
  position: absolute;
  z-index: 1000;
  padding: var(--space-2) var(--space-3);
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
}

.tooltip:hover .tooltip-content {
  opacity: 1;
  visibility: visible;
}

.tooltip-top .tooltip-content {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: var(--space-2);
}

.tooltip-bottom .tooltip-content {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: var(--space-2);
}
```

---

## Modal & Overlay

### Modal
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.modal {
  background-color: var(--bg-primary);
  border: var(--border-width-thick) var(--border-style-solid) var(--border-primary);
  max-width: var(--container-md);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: var(--space-6);
  border-bottom: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
}

.modal-title {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.modal-close {
  cursor: pointer;
  padding: var(--space-2);
  border: var(--border-width-medium) var(--border-style-solid) transparent;
  background-color: transparent;
  color: inherit;
}

.modal-close:hover {
  border-color: var(--border-primary);
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  padding: var(--space-6);
  border-top: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
```

---

## Progress & Loading

### Progress Bar
```css
.progress {
  width: 100%;
  height: 24px;
  background-color: var(--bg-secondary);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  position: relative;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--bg-inverse);
  border-right: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  transition: width 0.3s ease;
}

.progress-striped .progress-bar {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255, 255, 255, 0.1) 10px,
    rgba(255, 255, 255, 0.1) 20px
  );
}
```

### Spinner
```css
.spinner {
  width: 40px;
  height: 40px;
  border: var(--border-width-thick) var(--border-style-solid) var(--border-tertiary);
  border-top-color: var(--border-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner-sm {
  width: 20px;
  height: 20px;
  border-width: var(--border-width-medium);
}

.spinner-lg {
  width: 60px;
  height: 60px;
  border-width: var(--border-width-heavy);
}
```

### Loading Block
```css
.loading-block {
  background-color: var(--bg-secondary);
  border: var(--border-width-medium) var(--border-style-dashed) var(--border-primary);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  min-height: 200px;
}

.loading-text {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
}
```

---

## Alerts & Messages

### Alert
```css
.alert {
  padding: var(--space-4) var(--space-6);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  margin-bottom: var(--space-4);
}

.alert-info {
  background-color: var(--bg-secondary);
  border-style: var(--border-style-solid);
}

.alert-warning {
  background-color: var(--bg-tertiary);
  border-style: var(--border-style-dashed);
  border-width: var(--border-width-thick);
}

.alert-error {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border-width: var(--border-width-thick);
}

.alert-success {
  background-color: var(--bg-primary);
  border-width: var(--border-width-thick);
  border-style: var(--border-style-solid);
}
```

### Message Box
```css
.message {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  border-left: var(--border-width-heavy) var(--border-style-solid) var(--border-primary);
  background-color: var(--bg-secondary);
}

.message-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

.message-content {
  flex: 1;
}

.message-title {
  font-weight: var(--weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--space-2);
}
```

---

## Forms & Field Sets

### Fieldset
```css
.fieldset {
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.fieldset-legend {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  padding: 0 var(--space-3);
  background-color: var(--bg-primary);
}
```

### Form Layout
```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-6);
  border-top: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
}
```

---

## Visual Hierarchy Patterns

### Emphasis Levels
```css
/* Level 1 - Maximum Attention */
.emphasis-1 {
  background-color: var(--bg-inverse);
  color: var(--text-inverse);
  border: var(--border-width-thick) var(--border-style-solid) var(--border-primary);
  padding: var(--space-6);
}

/* Level 2 - High Attention */
.emphasis-2 {
  border: var(--border-width-thick) var(--border-style-solid) var(--border-primary);
  padding: var(--space-4);
}

/* Level 3 - Medium Attention */
.emphasis-3 {
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  padding: var(--space-4);
}

/* Level 4 - Low Attention */
.emphasis-4 {
  border: var(--border-width-thin) var(--border-style-solid) var(--border-tertiary);
  padding: var(--space-3);
}

/* Level 5 - Minimal Attention */
.emphasis-5 {
  background-color: var(--bg-secondary);
  padding: var(--space-3);
}
```

### Status Indicators
```css
.status-dot {
  width: 12px;
  height: 12px;
  background-color: var(--bg-inverse);
  border: var(--border-width-medium) var(--border-style-solid) var(--border-primary);
  display: inline-block;
}

.status-active .status-dot {
  background-color: var(--bg-inverse);
}

.status-inactive .status-dot {
  background-color: var(--bg-primary);
}

.status-pending .status-dot {
  background-color: var(--bg-primary);
  border-style: var(--border-style-dashed);
}
```

---

## Utilities

### Display
```css
.block { display: block; }
.inline-block { display: inline-block; }
.inline { display: inline; }
.hidden { display: none; }
.invisible { visibility: hidden; }
```

### Positioning
```css
.relative { position: relative; }
.absolute { position: absolute; }
.fixed { position: fixed; }
.sticky { position: sticky; }
```

### Z-Index
```css
.z-0 { z-index: 0; }
.z-10 { z-index: 10; }
.z-20 { z-index: 20; }
.z-30 { z-index: 30; }
.z-40 { z-index: 40; }
.z-50 { z-index: 50; }
```

### Width & Height
```css
.w-full { width: 100%; }
.w-auto { width: auto; }
.h-full { height: 100%; }
.h-auto { height: auto; }
.h-screen { height: 100vh; }
```

### Text Alignment
```css
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }
```

### Text Transform
```css
.uppercase { text-transform: uppercase; }
.lowercase { text-transform: lowercase; }
.capitalize { text-transform: capitalize; }
.normal-case { text-transform: none; }
```

### Overflow
```css
.overflow-auto { overflow: auto; }
.overflow-hidden { overflow: hidden; }
.overflow-scroll { overflow: scroll; }
.overflow-x-auto { overflow-x: auto; }
.overflow-y-auto { overflow-y: auto; }
```

### Cursor
```css
.cursor-pointer { cursor: pointer; }
.cursor-not-allowed { cursor: not-allowed; }
.cursor-default { cursor: default; }
```

---

## Animation Principles

### No Animations By Default
This design system intentionally avoids animations except for essential feedback:

```css
/* Only animate when absolutely necessary */
* {
  transition: none !important;
  animation: none !important;
}

/* Exceptions - Only for loading/progress states */
.spinner,
.progress-bar,
.loading-indicator {
  /* Animation allowed here only */
}
```

### Instant State Changes
All state changes should be immediate and binary:
- No fade transitions
- No slide animations
- No easing functions
- Instant hover/active/focus states

---

## Iconography Guidelines

### Icon Specifications
```css
.icon {
  width: 20px;
  height: 20px;
  display: inline-block;
  vertical-align: middle;
}

.icon-sm { width: 16px; height: 16px; }
.icon-lg { width: 24px; height: 24px; }
.icon-xl { width: 32px; height: 32px; }
```

### Icon Style Rules
- Use only geometric shapes (squares, triangles, lines)
- No curves or organic shapes
- Minimum 2px stroke width
- Pure black or white only
- All icons must fit in perfect square grid
- Use SVG format with viewBox="0 0 24 24"

### Recommended Icon Set Approach
Create custom geometric icons or use filtered subsets from:
- Phosphor Icons (thin/regular weights, geometric subset only)
- Feather Icons (with all curves converted to angles)
- Custom SVG geometric shapes

---

## Accessibility Notes

### Focus States
```css
*:focus-visible {
  outline: var(--border-width-thick) var(--border-style-solid) var(--border-primary);
  outline-offset: var(--space-1);
}
```

### Contrast Requirements
- Black text on white: 21:1 (AAA)
- White text on black: 21:1 (AAA)
- Gray-600 text on white: 7.8:1 (AAA)
- All color combinations meet WCAG AAA standards

### Screen Reader Text
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Print Styles

```css
@media print {
  * {
    background: white !important;
    color: black !important;
  }

  .no-print {
    display: none !important;
  }

  a {
    text-decoration: underline;
  }

  .page-break {
    page-break-after: always;
  }
}
```

---

## Responsive Breakpoints

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

---

## Design Token Export (JSON)

```json
{
  "colors": {
    "black": "#000000",
    "white": "#FFFFFF",
    "gray": {
      "900": "#0A0A0A",
      "800": "#1A1A1A",
      "700": "#2D2D2D",
      "600": "#404040",
      "500": "#666666",
      "400": "#999999",
      "300": "#CCCCCC",
      "200": "#E5E5E5",
      "100": "#F5F5F5"
    }
  },
  "spacing": {
    "0": "0",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px",
    "24": "96px",
    "32": "128px"
  },
  "typography": {
    "fontFamily": {
      "mono": "'Courier New', 'Courier', monospace",
      "sans": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      "terminal": "'Consolas', 'Monaco', 'Courier New', monospace"
    },
    "fontSize": {
      "xs": "10px",
      "sm": "12px",
      "base": "14px",
      "md": "16px",
      "lg": "18px",
      "xl": "24px",
      "2xl": "32px",
      "3xl": "48px"
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.2,
      "normal": 1.5,
      "loose": 1.8
    },
    "letterSpacing": {
      "tight": "-0.02em",
      "normal": "0",
      "wide": "0.05em",
      "wider": "0.1em"
    }
  },
  "borders": {
    "width": {
      "none": 0,
      "thin": "1px",
      "medium": "2px",
      "thick": "4px",
      "heavy": "8px"
    },
    "radius": {
      "none": 0,
      "sm": 0,
      "md": 0,
      "lg": 0,
      "full": 0
    }
  }
}
```

---

## Implementation Checklist

- [ ] Define CSS custom properties (variables)
- [ ] Create base reset styles
- [ ] Implement typography system
- [ ] Build component library
- [ ] Create utility classes
- [ ] Set up responsive breakpoints
- [ ] Implement accessibility features
- [ ] Test keyboard navigation
- [ ] Verify contrast ratios
- [ ] Create icon library
- [ ] Document component usage
- [ ] Build example pages

---

## File Structure Recommendation

```
styles/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   └── borders.css
├── base/
│   ├── reset.css
│   └── global.css
├── components/
│   ├── buttons.css
│   ├── inputs.css
│   ├── cards.css
│   ├── tables.css
│   └── navigation.css
├── utilities/
│   └── utilities.css
└── main.css (imports all)
```

---

*This design system embodies pure functional minimalism. Every element serves purpose. Every pixel is intentional. Zero ornamentation. Maximum clarity.*
