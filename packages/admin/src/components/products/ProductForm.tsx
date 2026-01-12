import { useState, useEffect } from "react"

import { Button } from "../ui/Button.js"
import { Input, Textarea } from "../ui/Input.js"
import { Modal, ModalFooter } from "../ui/Modal.js"

import type { ProductDTO } from "@lls/core"
import type { ReactNode, FormEvent } from "react"

interface ProductFormProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: ProductFormData) => Promise<void>
    product?: ProductDTO | null
    isLoading: boolean
}

export interface ProductFormData {
    name: string
    description: string
    price: number
    category: string
    imageUrl: string
}

// eslint-disable-next-line max-lines-per-function
export function ProductForm({
    isOpen,
    onClose,
    onSubmit,
    product,
    isLoading,
}: ProductFormProps): ReactNode {
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [price, setPrice] = useState("")
    const [category, setCategory] = useState("")
    const [imageUrl, setImageUrl] = useState("")
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        if (product) {
            setName(product.name)
            setDescription(product.description || "")
            setPrice(String(product.price.amount))
            setCategory(product.category || "")
            setImageUrl(product.imageUrl || "")
        } else {
            setName("")
            setDescription("")
            setPrice("")
            setCategory("")
            setImageUrl("")
        }
        setErrors({})
    }, [product, isOpen])

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!name.trim()) {
            newErrors["name"] = "Введите название"
        }
        if (!price.trim()) {
            newErrors["price"] = "Введите цену"
        } else if (isNaN(Number(price)) || Number(price) <= 0) {
            newErrors["price"] = "Введите корректную цену"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault()

        if (!validate()) {
            return
        }

        try {
            await onSubmit({
                name: name.trim(),
                description: description.trim(),
                price: Number(price),
                category: category.trim(),
                imageUrl: imageUrl.trim(),
            })
            onClose()
        } catch {
            // Error handled in parent
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={product ? "Редактировать товар" : "Добавить товар"}
            size="md"
        >
            <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <Input
                        label="Название"
                        placeholder="Пицца Маргарита"
                        value={name}
                        onChange={(e): void => setName(e.target.value)}
                        error={errors["name"]}
                        required
                    />

                    <Textarea
                        label="Описание"
                        placeholder="Описание товара..."
                        value={description}
                        onChange={(e): void => setDescription(e.target.value)}
                        rows={3}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Цена (UZS)"
                            type="number"
                            placeholder="50000"
                            value={price}
                            onChange={(e): void => setPrice(e.target.value)}
                            error={errors["price"]}
                            required
                        />

                        <Input
                            label="Категория"
                            placeholder="Пицца"
                            value={category}
                            onChange={(e): void => setCategory(e.target.value)}
                        />
                    </div>

                    <Input
                        label="URL изображения"
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e): void => setImageUrl(e.target.value)}
                        hint="Оставьте пустым, если нет изображения"
                    />
                </div>

                <ModalFooter>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </Button>
                    <Button type="submit" loading={isLoading}>
                        {product ? "Сохранить" : "Добавить"}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    )
}
