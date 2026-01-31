# Design System - UE Command Interface

**Version**: 1.0.0
**Last Updated**: 2026-01-31

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-31 | Initial release: Colors, Spacing, Typography, Borders, Components, States, Icons, Z-Index, Opacity, Shadows, Motion, Responsive Typography |

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│  BRUTALIST B&W  │  Zero ornamentation  │  All radius = 0       │
├─────────────────────────────────────────────────────────────────┤
│  Colors:    #000000 (black)  │  #FFFFFF (white)                 │
│  Base unit: 4px              │  Font: Sans-serif primary        │
│  Borders:   2px default      │  Padding: Minimal for density    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Colors

### Base Palette

| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| **Black** | `#000000` | 0, 0, 0 | Primary text, inverse bg, borders |
| **White** | `#FFFFFF` | 255, 255, 255 | Primary background |
| Gray-900 | `#0A0A0A` | 10, 10, 10 | Near black |
| Gray-800 | `#1A1A1A` | 26, 26, 26 | Dark backgrounds |
| Gray-700 | `#2D2D2D` | 45, 45, 45 | Secondary backgrounds |
| Gray-600 | `#404040` | 64, 64, 64 | Borders, dividers |
| Gray-500 | `#666666` | 102, 102, 102 | Disabled states |
| Gray-400 | `#999999` | 153, 153, 153 | Secondary text |
| Gray-300 | `#CCCCCC` | 204, 204, 204 | Subtle borders |
| Gray-200 | `#E5E5E5` | 229, 229, 229 | Light backgrounds |
| Gray-100 | `#F5F5F5` | 245, 245, 245 | Subtle backgrounds |

### Semantic Usage

| Purpose | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background Primary | White | Black |
| Background Secondary | Gray-100 | Gray-800 |
| Background Hover | Gray-100 | Gray-800 |
| Text Primary | Black | White |
| Text Secondary | Gray-600 | Gray-400 |
| Text Disabled | Gray-400 | Gray-500 |
| Border Primary | Black | White |
| Border Secondary | Gray-600 | Gray-400 |

---

## Spacing

**Base Unit: 4px** — Prefer minimal padding for information density.

| Token | px | Use |
|-------|-----|-----|
| space-1 | 4 | Micro gaps, icon margins |
| space-2 | 8 | **Default gap**, tight padding |
| space-3 | 12 | Button/input padding |
| space-4 | 16 | Card padding, form gaps |
| space-6 | 24 | Section gaps |
| space-8 | 32 | Large sections |
| space-12 | 48 | Page sections |
| space-16 | 64 | Hero sections |

**Padding Philosophy:**
- **Buttons**: 8px 12px (compact)
- **Inputs**: 8px 12px (compact)
- **Cards**: 16px (minimal)
- **Tables**: 8px 12px cells

### Layout Constants

| Element | Value |
|---------|-------|
| Header height | 64px |
| Sidebar width | 280px |
| Gutter | 24px |
| Grid columns | 12 |
| Grid gap | 24px |

### Container Widths

| Size | Width |
|------|-------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

---

## Typography

### Font Families

| Purpose | Font Stack |
|---------|------------|
| **Sans** (Primary) | -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif |
| **Mono** (Code only) | Consolas, Monaco, Courier New, monospace |

**Sans-serif for readability.** Mono only for code/terminal.

### Type Scale

| Name | Size | Weight | Line Height | Font | Use |
|------|------|--------|-------------|------|-----|
| Display | 48px | 700 | 1.1 | Sans | Hero text |
| H1 | 32px | 700 | 1.2 | Sans | Page titles |
| H2 | 24px | 600 | 1.3 | Sans | Section headers |
| H3 | 18px | 500 | 1.4 | Sans | Subheadings |
| Body | 14px | 400 | 1.5 | Sans | Default text |
| Label | 12px | 500 | 1.2 | Sans | Form labels (UPPERCASE) |
| Caption | 10px | 400 | 1.4 | Sans | Helper text |
| Code | 13px | 400 | 1.6 | Mono | Code blocks, terminal |

### Letter Spacing

| Name | Value | Use |
|------|-------|-----|
| tight | -0.02em | Display text |
| normal | 0 | Body text |
| wide | 0.05em | Labels |
| wider | 0.1em | Uppercase headings |

---

## Borders

| Name | Width | Use |
|------|-------|-----|
| none | 0 | No border |
| thin | 1px | Subtle dividers |
| **medium** | 2px | Default (buttons, inputs, cards) |
| thick | 4px | Emphasis, focus states |
| heavy | 8px | Maximum emphasis |

### Border Radius

**ALL ZERO.** No rounded corners. Ever.

### Border Styles

- `solid` - Default
- `dashed` - Error states, pending
- `dotted` - Rarely used

---

## Components

### Buttons

| Property | Value |
|----------|-------|
| Border | 2px solid black |
| Padding | **8px 12px** (compact) |
| Min height | 32px |
| Font | Sans, 13px, medium, UPPERCASE |
| Letter spacing | 0.02em |
| Radius | 0 |

**Variants:**
- **Primary**: Black bg, white text
- **Secondary**: White bg, black text, black border
- **Ghost**: Transparent, no border → border on hover
- **Danger**: Black bg, 4px border

**Sizes:**
| Size | Padding | Height | Font |
|------|---------|--------|------|
| sm | 4px 8px | 24px | 11px |
| md | 8px 12px | 32px | 13px |
| lg | 10px 16px | 40px | 14px |

### Inputs

| Property | Value |
|----------|-------|
| Border | 2px solid gray-600 |
| Border (hover) | 2px solid black |
| Border (focus) | 4px solid black |
| Padding | **8px 12px** (compact) |
| Min height | 32px |
| Font | **Sans, 13px** |
| Background | White |
| Placeholder | Gray-500 |

**States:**
- **Default**: Gray-600 border
- **Hover**: Black border
- **Focus**: 4px black border
- **Disabled**: Gray-300 bg, gray-400 text
- **Error**: 4px dashed black border

**Note**: Use Mono font only for code inputs.

### Cards

| Property | Value |
|----------|-------|
| Border | 2px solid black |
| Padding | **16px** (compact) |
| Background | White |
| Header | border-bottom only |
| Hover (interactive) | 4px border |

### Tables

| Element | Style |
|---------|-------|
| Header bg | Black |
| Header text | White, UPPERCASE, 12px, bold |
| Cell padding | **8px 12px** (compact) |
| Cell border | 1px gray-300 |
| Row hover | Gray-100 bg |
| Font | **Sans** (Mono for data columns only) |

### Alerts

| Type | Style |
|------|-------|
| Info | Gray-100 bg, 2px solid border |
| Warning | Gray-200 bg, 4px dashed border |
| Error | Black bg, white text, 4px solid |
| Success | White bg, 4px solid border |

---

## Visual Hierarchy

### Emphasis Levels

| Level | Style |
|-------|-------|
| 1 (Maximum) | Black bg, white text, 4px border |
| 2 (High) | White bg, 4px black border |
| 3 (Medium) | White bg, 2px black border |
| 4 (Low) | White bg, 1px gray border |
| 5 (Minimal) | Gray-100 bg, no border |

### Status Indicators

| State | Style |
|-------|-------|
| Active | Filled black square |
| Inactive | Empty square (white, black border) |
| Pending | Empty square, dashed border |

---

## Principles

### No Animations
- **Exception**: Spinners, progress bars only
- All state changes are instant
- No fades, slides, or easing

### Geometric Icons Only
- Squares, triangles, lines only
- No curves or organic shapes
- Min 2px stroke
- Pure black or white
- 24x24 grid

### Accessibility
- Black/White contrast: 21:1 (AAA)
- Gray-600 on white: 7.8:1 (AAA)
- Focus visible: 4px solid black outline
- Keyboard navigable

---

## Breakpoints

| Name | Width | Target |
|------|-------|--------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Laptop |
| xl | 1280px | Desktop |
| 2xl | 1536px | Large desktop |

---

## Component States

### State Matrix

| State | Border | Background | Text | Cursor |
|-------|--------|------------|------|--------|
| Default | gray-600 | white | black | default |
| Hover | black | white | black | pointer |
| Active | black | gray-100 | black | pointer |
| Focus | 4px black | white | black | - |
| Disabled | gray-300 | gray-200 | gray-500 | not-allowed |
| Loading | gray-600 | white | gray-500 | wait |
| Error | 4px dashed | white | black | - |

### Interactive Feedback

| Interaction | Response |
|-------------|----------|
| Click/Tap | Instant state change (no delay) |
| Focus | 4px solid black outline |
| Error | 4px dashed border |
| Success | Brief checkmark, then normal |

---

## Icons

### Sizes

| Name | Size | Touch Area | Use |
|------|------|------------|-----|
| xs | 12×12 | - | Inline indicators |
| sm | 16×16 | 32×32 | Secondary actions |
| md | 24×24 | 44×44 | **Default**, buttons |
| lg | 32×32 | 48×48 | Primary actions |
| xl | 48×48 | 56×56 | Hero icons |

### Touch Targets

| Platform | Minimum Size |
|----------|--------------|
| iOS | 44×44px |
| Android | 48×48px |
| Web (desktop) | 32×32px |

### Icon Margins

| Position | Margin |
|----------|--------|
| Before text | 8px right |
| After text | 8px left |
| Standalone | centered in touch area |

---

## Z-Index Scale

| Name | Value | Use |
|------|-------|-----|
| base | 0 | Default content |
| dropdown | 100 | Dropdown menus |
| sticky | 200 | Sticky headers |
| fixed | 300 | Fixed elements |
| modal-backdrop | 400 | Modal overlay |
| modal | 500 | Modal content |
| popover | 600 | Popovers, tooltips |
| toast | 700 | Notifications |
| max | 9999 | Emergency override |

---

## Opacity

| Name | Value | Use |
|------|-------|-----|
| 0 | 0% | Hidden |
| 10 | 10% | Subtle overlay |
| 25 | 25% | Light overlay |
| 50 | 50% | Medium overlay |
| 75 | 75% | Heavy overlay |
| 100 | 100% | Fully visible |

**Disabled state**: 50% opacity on entire element

---

## Shadows

Brutalist = minimal shadows. Use borders instead.

| Name | Value | Use |
|------|-------|-----|
| none | none | **Default** |
| sm | 2px 2px 0 black | Subtle depth (rare) |
| md | 4px 4px 0 black | Dropdown menus |
| lg | 8px 8px 0 black | Modals only |

**Rule**: Hard shadows only (0 blur). No soft shadows.

---

## Motion

### Duration

| Name | Value | Use |
|------|-------|-----|
| instant | 0ms | **Default** (no animation) |
| fast | 100ms | Loading spinners only |
| normal | 200ms | Progress bars only |

### Easing

| Name | Value | Use |
|------|-------|-----|
| linear | linear | Progress bars |
| step | steps(1) | Instant transitions |

**Philosophy**: State changes are instant. Animations are reserved for loading indicators only.

---

## Responsive Typography

| Style | sm (640) | md (768) | lg (1024+) |
|-------|----------|----------|------------|
| Display | 32px | 40px | 48px |
| H1 | 24px | 28px | 32px |
| H2 | 20px | 22px | 24px |
| Body | 14px | 14px | 14px |

---

## Quick Lookup

### Common Values

```
Black:        #000000
White:        #FFFFFF
Gray (mid):   #666666

Padding:      8px 12px (default for buttons/inputs)
Padding card: 16px
Gap default:  8px

Border:       2px solid black
Border focus: 4px solid black

Font:         Sans-serif, 13-14px
Font label:   12px UPPERCASE
Font code:    Mono, 13px
```

### Python/C++ Equivalent

```python
# Colors (0-255)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY_600 = (64, 64, 64)

# Spacing (minimal padding)
PADDING_DEFAULT = (8, 12)  # vertical, horizontal
PADDING_CARD = 16
GAP_DEFAULT = 8

# Typography
FONT_SIZE_BODY = 13
FONT_SIZE_LABEL = 12
FONT_SIZE_CODE = 13

# Borders
BORDER_MEDIUM = 2
BORDER_THICK = 4
```

```cpp
// Colors (0-255)
const FColor Black(0, 0, 0);
const FColor White(255, 255, 255);
const FColor Gray600(64, 64, 64);

// Spacing (minimal padding)
constexpr FMargin PaddingDefault(8.f, 12.f);
constexpr float PaddingCard = 16.f;
constexpr float GapDefault = 8.f;

// Typography
constexpr float FontSizeBody = 13.f;
constexpr float FontSizeLabel = 12.f;

// Borders
constexpr float BorderMedium = 2.f;
constexpr float BorderThick = 4.f;
```

---

## File Structure (Web)

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
│   └── tables.css
└── main.css
```

---

*Pure functional minimalism. Every pixel intentional. Zero ornamentation.*
