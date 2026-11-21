import { describe, expect, it } from "vitest"

import {
    ChannelPageError,
    TELEGRAM_WEB_BASE,
    WebChannelHistory,
    decodeEntities,
    readChannelPage,
    telegramWebBase,
} from "../src/telegram/channel-history.js"

/** One post as `t.me/s` writes it: the text block sits inside another of the same class. */
function post(id: number, inner: string, extra = ""): string {
    return `<div class="tgme_widget_message_wrap js-widget_message_wrap">
<div class="tgme_widget_message text_not_supported_wrap user-color-3 js-widget_message"
     data-post="abc_kanal/${id}" data-view="x">
  <div class="tgme_widget_message_bubble">
    <div class="tgme_widget_message_author accent_color"><a class="tgme_widget_message_owner_name"
      href="https://t.me/abc_kanal"><span dir="auto">ABC<i class="emoji"><b>🪅</b></i></span></a></div>
    ${extra}
    ${inner}
    <div class="tgme_widget_message_footer compact js-message_footer">
      <div class="tgme_widget_message_info short js-message_info">
        <span class="tgme_widget_message_meta"><a class="tgme_widget_message_date"
          href="https://t.me/abc_kanal/${id}"><time datetime="2026-11-21T0${id % 10}:15:30+00:00"
          class="time">09:15</time></a></span>
      </div>
    </div>
  </div>
</div></div>`
}

function text(html: string): string {
    return `<div class="tgme_widget_message_text js-message_text" dir="auto"><div
class="tgme_widget_message_text js-message_text" dir="auto">${html}</div></div>`
}

const ALBUM = `<div class="tgme_widget_message_grouped_wrap js-message_grouped_wrap">
  <div class="tgme_widget_message_grouped js-message_grouped">
    <div class="tgme_widget_message_grouped_layer js-message_grouped_layer">
      <a class="tgme_widget_message_photo_wrap grouped_media_wrap" href="https://t.me/abc_kanal/571?single"></a>
    </div>
  </div>
</div>`

const PAGE = `<!DOCTYPE html><html><body><section class="tgme_channel_history js-message_history">
<div class="tme_messages_more js-messages_more" data-before="571"></div>
${post(571, text("<b>Mafiya</b> oʻyini&#33; Narxi: 25&nbsp;000 so‘m<br/>Buyurtma uchun &amp; savollar"), ALBUM)}
<div class="tgme_widget_message_wrap js-widget_message_wrap"><div
  class="tgme_widget_message service_message js-widget_message" data-post="abc_kanal/572">
  <div class="tgme_widget_message_service_date">Channel photo updated</div></div></div>
${post(573, "")}
${post(574, text('Kubik &lt;3x3&gt; <i class="emoji"><b>🔥</b></i>'))}
${post(575, text("Boshqa botning tugmasi"), '<div class="tgme_widget_message_inline_keyboard"></div>')}
</section></body></html>`

function page(html: string): Response {
    return new Response(html, { headers: { "Content-Type": "text/html" } })
}

describe("a public channel's page", () => {
    it("reads each post: its number, words, album and date, newest first", async () => {
        const read = await readChannelPage(page(PAGE))
        expect(read.older).toBe(true)
        expect(read.posts).toEqual([
            {
                messageId: 574,
                album: false,
                text: "Kubik <3x3> 🔥",
                date: new Date("2026-11-21T04:15:30Z"),
            },
            { messageId: 573, album: false, date: new Date("2026-11-21T03:15:30Z") },
            {
                messageId: 571,
                album: true,
                text: "Mafiya oʻyini! Narxi: 25 000 so‘m\nBuyurtma uchun & savollar",
                date: new Date("2026-11-21T01:15:30Z"),
            },
        ])
    })

    it("the first post of the channel: no older page", async () => {
        const read = await readChannelPage(page(`<section>${post(5, text("Salom"))}</section>`))
        expect(read).toMatchObject({ older: false, posts: [{ messageId: 5, text: "Salom" }] })
    })

    it("asks for the page before a post; a page Telegram does not show is none", async () => {
        const asked: string[] = []
        const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
            asked.push(String(input))
            return asked.length === 1 ? page(PAGE) : new Response(null, { status: 302 })
        }
        const history = new WebChannelHistory(fetcher, TELEGRAM_WEB_BASE)
        expect((await history.page("abc_kanal", 576))?.posts).toHaveLength(3)
        expect(await history.page("abc_kanal")).toBeNull()
        expect(asked).toEqual(["https://t.me/s/abc_kanal?before=576", "https://t.me/s/abc_kanal"])
        const down = new WebChannelHistory(async () => {
            throw new TypeError("network")
        })
        await expect(down.page("abc_kanal")).rejects.toBeInstanceOf(ChannelPageError)
        const busy = new WebChannelHistory(async () => new Response("", { status: 502 }))
        await expect(busy.page("abc_kanal")).rejects.toBeInstanceOf(ChannelPageError)
    })

    it("only a local stand may point it elsewhere; entities read as written", () => {
        expect(telegramWebBase(undefined)).toBe(TELEGRAM_WEB_BASE)
        expect(telegramWebBase("http://localhost:8790/x")).toBe("http://localhost:8790")
        expect(telegramWebBase("https://evil.example")).toBe(TELEGRAM_WEB_BASE)
        expect(telegramWebBase("not a url")).toBe(TELEGRAM_WEB_BASE)
        expect(decodeEntities("&#x41;&#66;&quot;&unknown;&#0;")).toBe('AB"&unknown;&#0;')
    })
})
