# Product

## Register

product

## Users

- **Customers** in small towns and districts of Uzbekistan, mostly young people, ordering food,
  drinking water (19 l bottles) or groceries from a shop they already know. They open the shop's own Telegram
  bot on a phone, often on slow mobile internet, and want to order in about three taps.
  The product speaks Uzbek (Latin) only (owner's decision).
- **Shop owners**: small local businesses (a café, a water producer, a grocery store). They manage
  orders from the Telegram chat between other work, edit the catalog in "Мой магазин" on the
  phone and hand orders to their own couriers. They are not tech people.
- **Couriers**: today a shop's own person (often a family member or a hired driver). They get an
  order card in the shop's bot and press "Забрал" / "Доставил". They need the address, the
  landmark and the customer's phone — nothing else. They take no money: every order is paid
  to the shop's card before cooking. Next: people with a
  car in the district who deliver for several points through one Zumda courier bot and earn more.

## Product Purpose

Every offline point within 20–30 km of one district becomes an online point: today the customer
has to come and pick it up; with Zumda they order from home and a courier brings it. A point
without its own courier is served by the district's courier network.

Zumda gives each small shop its own ordering bot and Mini App under the shop's own brand
("powered by Zumda"). Customers order without calls and voice messages; owners get every order as
one clear card with one button for the next step. Success: real orders at the three pilot
shops (food, water, grocery), owners stop taking orders by phone, and customers come back to reorder.

The Zumda bot is the showcase of the district: one search across the products of every shop that
signed a marketplace deal. A tap opens that shop's storefront inside the Zumda bot; the order goes
to that one shop. Zumda earns on volume: a small service fee that the customer pays on every order
(a separate line; the shop's prices never change), plus a commission on showcase orders. Later the showcase grows into a marketplace with one cart from several shops.

## Brand Personality

Warm, simple, dependable. It should feel like the friendly shopkeeper you already know, not like a
corporation. Short, plain sentences. Big touch targets, very little text, friendly confirmations.

## Anti-references

- Template SaaS: grey identical cards, generic dashboards, "made by AI" look.
- Overloaded aggregators (Yandex Eats, Uzum): banners, promos, carousels fighting for attention.
- Old catalog websites: tiny text, tables, desktop layouts squeezed onto a phone.

## Design Principles

1. **The shop is the hero.** Its name, color and products come first; Zumda stays a quiet footer.
2. **One obvious next step.** Every screen has one primary action, placed where the thumb is
   (Telegram MainButton).
3. **Native to Telegram.** Always light (owner's decision), Telegram's frame painted to match, and
   the system font, so it feels like part of the chat, not a website.
4. **Light and fast.** Works on slow 3G: small bundle, skeletons instead of spinners, images only
   where they help choose.
5. **Plain words, one language.** Uzbek (Latin), written with care; no jargon, no English.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast on the light palette.
- Touch targets at least 44×44 px; body text at least 15 px.
- Respect `prefers-reduced-motion`.
- Status is never shown by color alone (icon + text).
