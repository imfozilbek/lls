# Welcome picture: scene "Ko'cha" (owner's choice, October 2026)

A street of the district: **OSHXONA**, **DO'KON**, **XIZMAT** (car wash and carpet) and a Zumda
courier on the road. Zumda serves shops, eateries and services, not only shops.

| File | Size | Where it goes |
|------|------|---------------|
| `zumda.png` | 1280×720 | Source of the Zumda bot's `/start` picture |
| `kuryer.png` | 1280×720 | Source of the courier bot's `/start` picture |
| `zumda-640.png` | 640×360 | @BotFather → `@zumdashop_bot` → Edit Bot → Edit Description Picture |
| `kuryer-640.png` | 640×360 | @BotFather → `@zumdashop_kuryer_bot` → Edit Bot → Edit Description Picture |
| `welcome.html` | | The scene itself (SVG + text), the source of every file above |

The bots send the JPEG copies from `packages/app/public/welcome/` (served at
`https://app.zumda.shop/welcome/zumda.jpg` and `kuryer.jpg`) with the greeting as the caption.
The Description Picture has no Bot API method: the owner sets it once in @BotFather.

## Render again after a change

Open `welcome.html` in Chromium (fonts: Rubik 700, Manrope 600–800 from Google Fonts) and
screenshot `#zumda` and `#kuryer`: at scale 1 for the 1280×720 PNG and the JPEG (quality 86),
at scale 0.5 for the 640×360 PNG. With the e2e Playwright:

```js
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } })
await page.goto("file:///…/brand/welcome/welcome.html")
await page.evaluate(() => document.fonts.ready)
await page.locator("#zumda").screenshot({ path: "zumda.png" })
```

Texts are Uzbek (Latin) and never use the em dash.
