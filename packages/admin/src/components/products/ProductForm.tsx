import { useState, useEffect, useCallback } from "react"

import { Button } from "../ui/Button.js"
import { Input, Textarea } from "../ui/Input.js"
import { Modal, ModalFooter } from "../ui/Modal.js"

import type { ProductDTO } from "@lls/core"
import type { ReactNode, FormEvent } from "react"

type ImageLoadState = "idle" | "loading" | "loaded" | "error"

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
    const [imageState, setImageState] = useState<ImageLoadState>("idle")
    const [errors, setErrors] = useState<Record<string, string>>({})

    const handleImageUrlChange = useCallback((url: string): void => {
        setImageUrl(url)
        if (url.trim()) {
            setImageState("loading")
        } else {
            setImageState("idle")
        }
    }, [])

    const handleImageLoad = useCallback((): void => {
        setImageState("loaded")
    }, [])

    const handleImageError = useCallback((): void => {
        setImageState("error")
    }, [])

    const clearImage = useCallback((): void => {
        setImageUrl("")
        setImageState("idle")
    }, [])

    useEffect(() => {
        if (product) {
            setName(product.name)
            setDescription(product.description || "")
            setPrice(String(product.price.amount))
            setCategory(product.category || "")
            setImageUrl(product.imageUrl || "")
            setImageState(product.imageUrl ? "loading" : "idle")
        } else {
            setName("")
            setDescription("")
            setPrice("")
            setCategory("")
            setImageUrl("")
            setImageState("idle")
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

                    <div className="space-y-3">
                        <Input
                            label="URL изображения"
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            value={imageUrl}
                            onChange={(e): void => handleImageUrlChange(e.target.value)}
                            hint="Оставьте пустым, если нет изображения"
                            error={imageState === "error" ? "Не удалось загрузить изображение" : undefined}
                        />

                        {imageUrl.trim() && (
                            <div className="relative">
                                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                    {imageState === "loading" && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                                        </div>
                                    )}
                                    {imageState === "error" && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                            <svg className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-sm">Изображение не найдено</span>
                                        </div>
                                    )}
                                    <img
                                        src={imageUrl}
                                        alt="Превью товара"
                                        className={`h-full w-full object-contain transition-opacity duration-200 ${
                                            imageState === "loaded" ? "opacity-100" : "opacity-0"
                                        }`}
                                        onLoad={handleImageLoad}
                                        onError={handleImageError}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-md transition-colors hover:bg-red-600"
                                    title="Удалить изображение"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
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
