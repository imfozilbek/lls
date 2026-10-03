import { CATEGORIES } from "../../../domain/enums/category.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { requireOneOf } from "../../../domain/shared/guards.js"
import { searchWords } from "../../../domain/shared/search-text.js"
import { emptyPage, normalizePage } from "../../dtos/pagination.js"
import { toShopOwnerDTO, toShopPublicDTO } from "../../dtos/shop.dto.js"
import { toShowcaseProductDTO, toShowcaseShopRef } from "../../dtos/showcase.dto.js"

import type { Page } from "../../dtos/pagination.js"
import type { ShopOwnerDTO, ShopPublicDTO } from "../../dtos/shop.dto.js"
import type { ShowcaseProductDTO, ShowcaseShopRef } from "../../dtos/showcase.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { ProductRepository } from "../../ports/product-repository.js"

/** Shops of the Zumda showcase: open ones first, then by name. */
export class ListShowcaseShopsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<ShopPublicDTO[]> {
        const now = this.clock.now()
        const shops = (await this.businesses.listInShowcase()).map((b) => toShopPublicDTO(b, now))
        return shops.sort(
            (a, b) => Number(b.isOpen) - Number(a.isOpen) || a.name.localeCompare(b.name),
        )
    }
}

export interface SearchShowcaseInput {
    text?: string
    category?: string
    page?: number
    limit?: number
}

/** One search across the products of every showcase shop. A tap then opens that shop. */
export class SearchShowcaseUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly products: ProductRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: SearchShowcaseInput): Promise<Page<ShowcaseProductDTO>> {
        const request = normalizePage(input)
        const words = searchWords(input.text ?? "")
        const category =
            input.category === undefined
                ? undefined
                : requireOneOf("category", input.category, CATEGORIES)
        if (words.length === 0 && category === undefined) {
            return emptyPage(request)
        }
        const now = this.clock.now()
        const [page, shops] = await Promise.all([
            this.products.searchShowcase({ words, category, availableAt: now }, request),
            this.businesses.listInShowcase(),
        ])
        const refs = new Map<string, ShowcaseShopRef>(
            shops.map((shop) => [shop.id, toShowcaseShopRef(shop, now)]),
        )
        const data: ShowcaseProductDTO[] = []
        for (const product of page.data) {
            const shop = refs.get(product.businessId)
            if (shop) {
                data.push(toShowcaseProductDTO(product, shop))
            }
        }
        return { data, meta: { ...page.meta } }
    }
}

export interface SetMarketplaceTermsInput {
    actorTelegramId: number
    slug: string
    /** Commission on goods in basis points (500 = 5%); `null` takes the shop out of the showcase. */
    commissionBps: number | null
}

/** A platform admin signs (or ends) a shop's marketplace deal. */
export class SetMarketplaceTermsUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly platformAdminIds: readonly number[],
        private readonly clock: Clock,
    ) {}

    async execute(input: SetMarketplaceTermsInput): Promise<ShopOwnerDTO> {
        if (!this.platformAdminIds.includes(input.actorTelegramId)) {
            throw ForbiddenError.notPlatformAdmin()
        }
        const business = await this.businesses.findBySlug(input.slug)
        if (!business) {
            throw EntityNotFoundError.businessBySlug(input.slug)
        }
        const now = this.clock.now()
        if (input.commissionBps === null) {
            business.leaveMarketplace()
        } else {
            business.joinMarketplace(input.commissionBps, now)
        }
        await this.businesses.save(business)
        return toShopOwnerDTO(business, now)
    }
}
