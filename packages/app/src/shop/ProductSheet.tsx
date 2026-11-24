import { Suspense, lazy } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { formatMoney, formatQuantity } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { useCart } from "../stores/cart.js"
import { PlusIcon } from "../ui/icons.js"
import { Button, Spinner, Stepper } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"
import { WriteShopLink } from "../ui/write-shop.js"

import { AgeBadge } from "./age-badge.js"
import { ProductGallery } from "./product-gallery.js"
import { hasOptions } from "./product-options.js"

import type { ProductDTO } from "@zumda/core"

/** Only products with variants or add-ons need it: its own small chunk. */
const OptionsPicker = lazy(() =>
    import("./OptionsPicker.js").then((m) => ({ default: m.OptionsPicker })),
)

/** One product up close: the whole photo, the whole description, and the same «+». */
export function ProductSheet({
    product,
    onClose,
}: {
    product: ProductDTO
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const quantity = useCart((state) => state.lines[product.id] ?? 0)
    const add = useCart((state) => state.add)
    const remove = useCart((state) => state.remove)
    const unit = (t.units as Record<string, string>)[product.unit] ?? product.unit
    return (
        <Sheet title={product.name} onClose={onClose}>
            <div className="flex flex-col gap-3">
                <ProductGallery product={product} />
                {product.description ? (
                    <p className="whitespace-pre-line text-tg-subtitle">{product.description}</p>
                ) : null}
                {hasOptions(product) && !product.soldOut ? (
                    <Suspense
                        fallback={
                            <div className="flex h-40 items-center justify-center text-tg-hint">
                                <Spinner className="h-6 w-6" />
                            </div>
                        }
                    >
                        <OptionsPicker product={product} onDone={onClose} />
                    </Suspense>
                ) : (
                    <div className="flex items-center justify-between gap-3">
                        <p>
                            <span className="text-lg font-bold">
                                {formatMoney(product.price, language)}
                            </span>
                            <span className="text-tg-hint"> / {unit}</span>
                            <AgeBadge product={product} />
                        </p>
                        {product.soldOut ? (
                            // Seen as it is, never added (owner's decision, November 2026).
                            <Button variant="surface" disabled>
                                {t.shop.soldOut}
                            </Button>
                        ) : quantity === 0 ? (
                            <Button
                                icon={<PlusIcon size={20} />}
                                onClick={(): void => {
                                    haptic.tap()
                                    add(product.id, product.step)
                                    // Back to the menu at once: the card there shows «− 1 +»,
                                    // and the next product is one tap away.
                                    onClose()
                                }}
                            >
                                {t.shop.add}
                            </Button>
                        ) : (
                            <Stepper
                                quantity={quantity}
                                display={formatQuantity(quantity, product.unit, t.units)}
                                onAdd={(): void => add(product.id, product.step)}
                                onRemove={(): void => remove(product.id, product.step)}
                                label={product.name}
                            />
                        )}
                    </div>
                )}
                {/* A question about it goes to the shop's people, with the product named. */}
                <WriteShopLink about={{ productId: product.id }} />
            </div>
        </Sheet>
    )
}
