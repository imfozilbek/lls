# Product

## Register

product

## Users

- **Customers** in small towns and districts of Uzbekistan, mostly young people, ordering food,
  drinking water (19 l bottles) or groceries from a shop they already know. They open the shop's own Telegram
  bot on a phone, often on slow mobile internet, and want to order in about three taps.
  They speak Uzbek (Latin) or Russian.
- **Shop owners**: small local businesses (a café, a water producer, a grocery store). They manage
  orders from the Telegram chat between other work, edit the catalog in "Мой магазин" on the
  phone and hand orders to their own couriers. They are not tech people.
- **Couriers** of one shop (often a family member or a hired driver). They get an order card in
  the shop's bot and press "Забрал" / "Доставил". They need the address, the landmark, the
  customer's phone and how much cash to collect — nothing else.

## Product Purpose

LLS gives each small shop its own ordering bot and Mini App under the shop's own brand
("powered by LLS"). Customers order without calls and voice messages; owners get every order as
one clear card with one button for the next step. Success: real orders at the three pilot
shops (food, water, grocery), owners stop taking orders by phone, and customers come back to reorder.

The LLS bot is the showcase of the district: one search across the products of every shop that
signed a marketplace deal. A tap opens that shop's storefront inside the LLS bot; the order goes
to that one shop. LLS earns a commission only on these showcase orders; a shop's own bot stays the
shop's. Later the showcase grows into a marketplace with one cart from several shops.

## Brand Personality

Warm, simple, dependable. It should feel like the friendly shopkeeper you already know, not like a
corporation. Short, plain sentences. Big touch targets, very little text, friendly confirmations.

## Anti-references

- Template SaaS: grey identical cards, generic dashboards, "made by AI" look.
- Overloaded aggregators (Yandex Eats, Uzum): banners, promos, carousels fighting for attention.
- Old catalog websites: tiny text, tables, desktop layouts squeezed onto a phone.

## Design Principles

1. **The shop is the hero.** Its name, color and products come first; LLS stays a quiet footer.
2. **One obvious next step.** Every screen has one primary action, placed where the thumb is
   (Telegram MainButton).
3. **Native to Telegram.** Follow the user's Telegram theme (light and dark) and system font, so it
   feels like part of the chat, not a website.
4. **Light and fast.** Works on slow 3G: small bundle, skeletons instead of spinners, images only
   where they help choose.
5. **Plain words, two languages.** Uzbek and Russian with equal care; no jargon, no English.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast in both Telegram light and dark themes.
- Touch targets at least 44×44 px; body text at least 15 px.
- Respect `prefers-reduced-motion`.
- Status is never shown by color alone (icon + text).
