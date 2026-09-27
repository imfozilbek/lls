/**
 * How far a Telegram identity can be trusted.
 *
 * - `trusted`: signed by the LLS bot (only LLS holds its token) or delivered by Telegram itself in a
 *   webhook update. The user is real.
 * - `shop`: signed with a shop bot's token. The shop owner holds that token and could sign any
 *   user id, so the identity counts only inside that shop: it never reveals or changes data the
 *   customer shared elsewhere (the phone, the name).
 */
export type IdentityScope = { kind: "trusted" } | { kind: "shop"; businessId: string }

export const TRUSTED_SCOPE: IdentityScope = { kind: "trusted" }

export function shopScope(businessId: string): IdentityScope {
    return { kind: "shop", businessId }
}
