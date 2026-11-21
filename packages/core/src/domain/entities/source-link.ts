import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireText } from "../shared/guards.js"

/**
 * Where a customer came from (owner's decision, November 2026): a post of the product in the
 * shop's own channel, or a named link the owner gave to an ad in someone else's channel. Both
 * are `t.me/<shop bot>?start=s_<id>`; the shop's bot remembers who pressed it.
 */
export enum SourceLinkKind {
    POST = "post",
    AD = "ad",
}

export const SOURCE_LINK_KINDS: readonly SourceLinkKind[] = Object.values(SourceLinkKind)

/** «Super kids»: the ad's name, short enough for a row in the list. */
export const LINK_LABEL_MAX = 40
/** The owner's words in a post: Telegram's caption is 1024, the name and the price need room. */
export const POST_TEXT_MAX = 900
/** Live ad links of one shop. */
export const MAX_AD_LINKS = 50
/** A product's newest live posts edited when its name, price or age changes. */
export const MAX_SYNCED_POSTS = 20
/** An order counts for the link the customer pressed within this time (the last one wins). */
export const SOURCE_VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** The code in the link: 8 random bytes, base64url (Telegram's start payload takes it whole). */
const CODE_BYTES = 8
const CODE = /^[A-Za-z0-9_-]{11}$/

/** The post in the channel: where it is, and Telegram's photo to show again in the bot. */
export interface PostRef {
    chatId: number
    messageId: number
    photoFileId?: string
}

/** What the link brought. Revenue is the goods of delivered orders, integer UZS. */
export interface LinkCounts {
    opens: number
    orders: number
    sales: number
    revenue: number
}

export interface SourceLinkProps {
    id: string
    businessId: string
    kind: SourceLinkKind
    /** The product it opens; an ad link may open the whole shop. */
    productId?: string
    label?: string
    post?: PostRef
    ownerText?: string
    /** The post's facts when it was last written (`postKeyOf`). */
    postKey?: string
    counts: LinkCounts
    createdAt: Date
    deletedAt?: Date
}

const NO_COUNTS: LinkCounts = { opens: 0, orders: 0, sales: 0, revenue: 0 }

export class SourceLink {
    private constructor(private props: SourceLinkProps) {}

    /** A new code, unguessable enough that a link is never found by trying. */
    static newCode(): string {
        const bytes = crypto.getRandomValues(new Uint8Array(CODE_BYTES))
        const base64 = btoa(String.fromCharCode(...bytes))
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    }

    static isCode(value: string): boolean {
        return CODE.test(value)
    }

    static ad(input: {
        businessId: string
        label: string
        productId?: string
        now: Date
    }): SourceLink {
        return new SourceLink({
            id: SourceLink.newCode(),
            businessId: input.businessId,
            kind: SourceLinkKind.AD,
            label: requireText("label", input.label, LINK_LABEL_MAX),
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            counts: { ...NO_COUNTS },
            createdAt: input.now,
        })
    }

    /** A post about to be sent: it gets its place in the channel with `posted`. */
    static post(input: {
        businessId: string
        productId: string
        ownerText?: string
        postKey: string
        now: Date
    }): SourceLink {
        const ownerText = optionalText("text", input.ownerText, POST_TEXT_MAX)
        return new SourceLink({
            id: SourceLink.newCode(),
            businessId: input.businessId,
            kind: SourceLinkKind.POST,
            productId: input.productId,
            ...(ownerText === undefined ? {} : { ownerText }),
            postKey: input.postKey,
            counts: { ...NO_COUNTS },
            createdAt: input.now,
        })
    }

    static restore(props: SourceLinkProps): SourceLink {
        return new SourceLink({ ...props, counts: { ...props.counts } })
    }

    get id(): string {
        return this.props.id
    }

    get businessId(): string {
        return this.props.businessId
    }

    get kind(): SourceLinkKind {
        return this.props.kind
    }

    get isPost(): boolean {
        return this.props.kind === SourceLinkKind.POST
    }

    get productId(): string | undefined {
        return this.props.productId
    }

    get label(): string | undefined {
        return this.props.label
    }

    get post(): PostRef | undefined {
        return this.props.post
    }

    get ownerText(): string | undefined {
        return this.props.ownerText
    }

    get postKey(): string | undefined {
        return this.props.postKey
    }

    get counts(): LinkCounts {
        return { ...this.props.counts }
    }

    get createdAt(): Date {
        return this.props.createdAt
    }

    get deletedAt(): Date | undefined {
        return this.props.deletedAt
    }

    get isLive(): boolean {
        return this.props.deletedAt === undefined
    }

    /** The post is in the channel now. */
    posted(ref: PostRef): void {
        if (!this.isPost || this.props.post) {
            throw new ValidationError("Only a new post is placed in the channel")
        }
        this.props = { ...this.props, post: { ...ref } }
    }

    /** Its name, price and age were written again. */
    resynced(postKey: string): void {
        this.props = { ...this.props, postKey }
    }

    /** Gone from the list: an ad link stops counting, a post was deleted from the channel. */
    remove(now: Date): void {
        if (this.props.deletedAt === undefined) {
            this.props = { ...this.props, deletedAt: now }
        }
    }
}
