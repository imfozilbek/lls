import { describe, it, expect } from "vitest"

import { Customer } from "../../../domain/entities/customer.js"
import { Address } from "../../../domain/value-objects/address.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

describe("Customer", () => {
    const createCustomer = (): Customer => {
        return Customer.create({
            id: "cust-id",
            telegramId: TelegramId.create(123456789),
            name: "John Doe",
            phone: Phone.create("+998901234567"),
            address: Address.create("Main St", "Tashkent"),
        })
    }

    describe("create", () => {
        it("should create customer with valid data", () => {
            const customer = createCustomer()
            expect(customer.id).toBe("cust-id")
            expect(customer.name).toBe("John Doe")
            expect(customer.telegramId.value).toBe(123456789)
        })

        it("should set timestamps on creation", () => {
            const customer = createCustomer()
            expect(customer.createdAt).toBeInstanceOf(Date)
            expect(customer.updatedAt).toBeInstanceOf(Date)
        })
    })

    describe("updateProfile", () => {
        it("should update customer name and phone", () => {
            const customer = createCustomer()
            const newPhone = Phone.create("+998909876543")
            customer.updateProfile("Jane Doe", newPhone)
            expect(customer.name).toBe("Jane Doe")
            expect(customer.phone.number).toBe("+998909876543")
        })
    })

    describe("updateAddress", () => {
        it("should update customer address", () => {
            const customer = createCustomer()
            const newAddress = Address.create("New St", "Samarkand")
            customer.updateAddress(newAddress)
            expect(customer.address.city).toBe("Samarkand")
        })
    })

    describe("toJSON", () => {
        it("should serialize customer to JSON", () => {
            const customer = createCustomer()
            const json = customer.toJSON()
            expect(json.id).toBe("cust-id")
            expect(json.name).toBe("John Doe")
        })
    })
})
