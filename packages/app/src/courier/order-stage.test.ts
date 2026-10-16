import { CourierStatus, OrderStatus } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { emptyReason, stageRank } from "./order-stage.js"

import type { Dictionary } from "../i18n/index.js"
import type { CourierHomeDTO } from "@zumda/core"

const t = {
    courier: {
        emptyOffShift: "off shift",
        emptyWaiting: "waiting",
        emptyDayOff: "day off",
        emptyText: "usual",
    },
} as unknown as Dictionary

type Home = Pick<CourierHomeDTO, "profile" | "shops">

function home(onShift: boolean, shops: { status: CourierStatus; worksToday: boolean }[]): Home {
    return { profile: { onShift }, shops } as unknown as Home
}

describe("the courier's screen", () => {
    it("puts the order on the way first, then the ready one, then the rest", () => {
        const orders = [
            { status: OrderStatus.PREPARING },
            { status: OrderStatus.READY },
            { status: OrderStatus.PICKED_UP },
        ]
        expect(
            [...orders].sort((a, b) => stageRank(a) - stageRank(b)).map((o) => o.status),
        ).toEqual([OrderStatus.PICKED_UP, OrderStatus.READY, OrderStatus.PREPARING])
    })

    it("says why nothing comes", () => {
        const active = { status: CourierStatus.ACTIVE, worksToday: true }
        expect(emptyReason(t, home(false, [active]))).toBe("off shift")
        expect(
            emptyReason(t, home(true, [{ status: CourierStatus.PENDING, worksToday: false }])),
        ).toBe("waiting")
        expect(emptyReason(t, home(true, [{ ...active, worksToday: false }]))).toBe("day off")
        expect(emptyReason(t, home(true, [active]))).toBe("usual")
    })
})
