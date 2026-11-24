/**
 * «Raqamni mijozlarga ko'rsatmaslik» (owner's decision, November 2026; goal 24) works only while
 * the shop's support group answers customers.
 * - `available`: a group is there; the switch flips.
 * - `needsGroup`: no group and the number shown; a tap says to connect the group first.
 * - `groupLost`: the owner hid the number, then the group went; customers see it again, and the
 *   switch still turns off.
 */
export type PhoneSwitchState = "available" | "needsGroup" | "groupLost"

export function phoneSwitchState(hidden: boolean, groupConnected: boolean): PhoneSwitchState {
    if (groupConnected) {
        return "available"
    }
    return hidden ? "groupLost" : "needsGroup"
}
