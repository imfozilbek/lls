import { useLanguage, useT } from "../i18n/index.js"
import { formatMoney, formatQuantity } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"
import { useCart } from "../stores/cart.js"
import { PlusIcon } from "../ui/icons.js"
import { Button, Stepper } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { Sheet } from "../ui/sheet.js"

import type { ProductDTO } from "@zumda/core"

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
                {product.imageKey ? (
                    <ProductImage
                        imageKey={product.imageKey}
                        category={product.category}
                        alt={product.name}
                        className="aspect-[4/3] w-full rounded-tile"
                    />
                ) : null}
                {product.description ? (
                    <p className="whitespace-pre-line text-tg-subtitle">{product.description}</p>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                    <p>
                        <span className="text-lg font-bold">
                            {formatMoney(product.price, language)}
                        </span>
                        <span className="text-tg-hint"> / {unit}</span>
                    </p>
                    {quantity === 0 ? (
                        <Button
                            icon={<PlusIcon size={20} />}
                            onClick={(): void => {
                                haptic.tap()
                                add(product.id, product.step)
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
            </div>
        </Sheet>
    )
}
