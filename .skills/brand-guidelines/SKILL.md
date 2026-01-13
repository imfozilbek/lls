---
name: brand-guidelines
description: LLS brand identity - Sky blue theme for local delivery platform
---

# LLS (LocalLoopSolutions) Brand Guidelines

## Brand Identity

**Product:** LLS — Local delivery platform for small businesses
**Mood:** Fast, reliable, local, friendly, accessible
**Theme:** Delivery/Logistics with local community focus

## Color Palette

### Primary Colors (Sky Blue - Speed & Trust)
| Name | HEX | Usage |
|------|-----|-------|
| primary-50 | #F0F9FF | Light backgrounds |
| primary-100 | #E0F2FE | Hover backgrounds |
| primary-200 | #BAE6FD | Borders |
| primary-300 | #7DD3FC | Light accents |
| primary-400 | #38BDF8 | Highlights |
| primary-500 | #0EA5E9 | **Primary DEFAULT** |
| primary-600 | #0284C7 | Hover states |
| primary-700 | #0369A1 | Active states |
| primary-800 | #075985 | Dark accents |
| primary-900 | #0C4A6E | Darkest |

### Secondary Colors (Emerald - Success)
| Name | HEX | Usage |
|------|-----|-------|
| secondary-500 | #10B981 | Success states |
| secondary-600 | #059669 | Delivered status |

### Warning Colors (Amber)
| Name | HEX | Usage |
|------|-----|-------|
| warning-500 | #F59E0B | Pending, in-transit |
| warning-600 | #D97706 | Warnings |

### Error Colors (Red)
| Name | HEX | Usage |
|------|-----|-------|
| error-500 | #EF4444 | Errors, cancelled |
| error-600 | #DC2626 | Critical errors |

### Neutral Colors
| Name | HEX | Usage |
|------|-----|-------|
| gray-50 | #F9FAFB | Backgrounds |
| gray-100 | #F3F4F6 | Cards |
| gray-200 | #E5E7EB | Borders |
| gray-500 | #6B7280 | Muted text |
| gray-700 | #374151 | Secondary text |
| gray-900 | #111827 | Primary text |

## Typography

| Element | Font | Fallback |
|---------|------|----------|
| All text | System | -apple-system, BlinkMacSystemFont, Segoe UI |

## Order Status Colors

| Status | Color | HEX |
|--------|-------|-----|
| pending | gray | #6B7280 |
| accepted | primary | #0EA5E9 |
| preparing | warning | #F59E0B |
| ready | primary-dark | #0284C7 |
| picked_up | warning-dark | #D97706 |
| delivered | success | #10B981 |
| cancelled | error | #EF4444 |

## Business Type Colors

| Type | Color | Usage |
|------|-------|-------|
| Food | #F59E0B | Restaurants, cafes |
| Construction | #6B7280 | Building materials |
| Water | #0EA5E9 | Water delivery |

## Usage Rules

1. **Sky blue for brand** — Primary color throughout
2. **Green for success** — Delivered orders, confirmations
3. **Amber for in-progress** — Preparing, in-transit states
4. **Simple, clear UI** — Focus on usability
5. **Mobile-first** — Telegram Mini App focused
6. **Fast loading** — Minimal visual complexity

## Button Styles

| Type | Background | Text | Border |
|------|------------|------|--------|
| Primary | primary-500 | white | none |
| Secondary | gray-100 | gray-700 | gray-200 |
| Success | secondary-500 | white | none |
| Danger | error-500 | white | none |
| Ghost | transparent | primary-500 | none |

## Card Styles

```css
/* Order card */
background: white;
border-radius: 0.75rem;
border: 1px solid #E5E7EB;
padding: 1rem;

/* Business card */
background: white;
border-radius: 1rem;
box-shadow: 0 1px 3px rgba(0,0,0,0.1);
```

## Status Badges

```css
/* Status badge base */
padding: 0.25rem 0.75rem;
border-radius: 9999px;
font-size: 0.75rem;
font-weight: 500;

/* Delivered */
background: #D1FAE5;
color: #065F46;

/* Pending */
background: #F3F4F6;
color: #374151;

/* In transit */
background: #FEF3C7;
color: #92400E;
```
