import { describe, expect, it, vi } from "vitest"

import { singleFlight } from "./polling.js"

/** A refresh the test finishes by hand: a request still waiting on the network. */
function pending(): { run: () => Promise<void>; finish: () => void } {
    let finish = (): void => undefined
    const run = vi.fn(
        () =>
            new Promise<void>((resolve) => {
                finish = resolve
            }),
    )
    return { run, finish: (): void => finish() }
}

async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("singleFlight", () => {
    it("skips ticks while the last one still waits, then goes again", async () => {
        const work = pending()
        const tick = singleFlight(work.run)
        tick()
        await settle()
        tick()
        tick()
        await settle()
        expect(work.run).toHaveBeenCalledOnce()
        work.finish()
        await settle()
        tick()
        await settle()
        expect(work.run).toHaveBeenCalledTimes(2)
    })

    it("the app coming back runs at once, whatever an old tick waits on", async () => {
        const work = pending()
        const tick = singleFlight(work.run)
        tick()
        await settle()
        tick(true)
        await settle()
        expect(work.run).toHaveBeenCalledTimes(2)
    })

    it("a failed tick is swallowed and the next one runs", async () => {
        const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined)
        const tick = singleFlight(run)
        tick()
        await settle()
        tick()
        await settle()
        expect(run).toHaveBeenCalledTimes(2)
    })
})
