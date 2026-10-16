/**
 * Once a session: an owner of one business (not an admin) lands in it, not on a list of one
 * (owner's decision, October 2026). A business opened by a bot message counts as that landing:
 * Back from it shows the list, never the same business again.
 */
let landed = false

export function hasLanded(): boolean {
    return landed
}

export function markLanded(): void {
    landed = true
}
