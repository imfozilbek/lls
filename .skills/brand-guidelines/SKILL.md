---
name: brand-guidelines
description: LLS white-label UI rules - the shop's brand leads, the app is always light and speaks Uzbek, LLS stays in the background
---

# LLS Brand Guidelines (white-label)

Read this before any UI work in `packages/app`. Product context: `PRODUCT.md`.

## Who the brand belongs to

- **The shop is the hero.** Customers see the shop's name, logo and color. LLS appears only as a
  small "LLS asosida ishlaydi / Работает на LLS" line at the bottom of the storefront.
- **LLS's own color** (#0EA5E9, sky blue) is used only where no shop exists yet: onboarding in the
  platform bot, and as the fallback when a shop has no color.
- **Three business types** share one design: food, water, grocery. Only words and a few icons
  change per type (see "Words per business type").

## Color system

All colors come from three sources. Nothing else is allowed.

| Source | Tokens (Tailwind) | Use |
|--------|-------------------|-----|
| Light palette | `tg-bg`, `tg-text`, `tg-hint`, `tg-secondary`, `tg-section`, `tg-separator`, `tg-destructive`, `tg-subtitle`, `tg-link` (values: `--ui-*` in `src/index.css`) | Backgrounds, text, borders. Always light: Telegram's dark theme is ignored |
| Shop brand | `brand` (`--brand-rgb`), `brand-ink` (`--brand-ink-rgb`) | Primary buttons, selected chips, stepper, active status, focus ring |
| Status hues | `success` #10B981, `warning` #F59E0B, `danger` #EF4444 | Tints (`/10`–`/15`) and icons only, never as text on white |

Rules:
- Text on the brand color always uses `brand-ink` (white or near-black, chosen by `readableInk()`
  for WCAG contrast). Never hard-code `text-white` on a shop color.
- Status badges: tinted background + palette text + colored icon. This keeps AA contrast.
- **Always light** (owner's decision). Use the palette tokens, never raw `bg-white` or hex in
  components: the palette stays in one place (`--ui-*`), so a dark palette would be one more block.
- Shop color picker offers only swatches that pass contrast with `brand-ink`.

## Typography

- System font stack (`-apple-system`, `Segoe UI`, `Roboto`, …): 0 KB, native look in Telegram.
- Body text 15 px minimum; hints 14 px (`text-sm`) only for secondary lines.
- Money uses `tabular-nums` and narrow no-break spaces: `78 000 so'm`.

## Shape and spacing

| Token | Value | Use |
|-------|-------|-----|
| `rounded-tile` | 1.125rem | Product tiles, cards |
| `rounded-control` | 0.875rem | Inputs, buttons, rows |
| `rounded-full` | — | Chips, stepper, avatars |
| Side padding | 16 px (`px-4`) | Every screen |
| Touch target | ≥ 44 px | Every tappable element |

## Motion

- CSS only: `rise`, `pop`, `bump`, `fade-in`, `ring`, `shimmer` in `tailwind.config.ts`.
- Easing `ease-out-quart`, 150–300 ms. Every tappable element has a pressed state (`.tap`) and a
  visible focus ring. `prefers-reduced-motion` turns motion off.

## Words per business type

| Idea | Food | Water / Grocery |
|------|------|-----------------|
| Product list | Menyu | Katalog |
| Status "preparing" | Tayyorlanmoqda (chef icon) | Yig'ilmoqda (box icon) |
| Delivered hint | Yoqimli ishtaha! | Rahmat! |

Uzbek (Latin) only (owner's decision): no Cyrillic in any dictionary (`dictionaries.test.ts`).
Another language would be one more dictionary with the same keys.

## Empty states and icons

- Custom line icons (`ui/icons.tsx`), stroke 1.75, `currentColor`.
- Empty states: one icon in a brand-tinted rounded square, one sentence, one action.
- No stock illustrations, no emoji in the app UI (emoji are fine in bot messages).
