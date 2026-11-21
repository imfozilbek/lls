import { Icon } from "../ui/icons.js"

import type { IconProps } from "../ui/icons.js"

/** The shop's channel: a megaphone, the word going out to many. */
export const MegaphoneIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M3.5 10.5v3A1.5 1.5 0 0 0 5 15h1.5l9 4.5v-15l-9 4.5H5a1.5 1.5 0 0 0-1.5 1.5Z" />
        <path d="m7 15 1.2 4.2a1.2 1.2 0 0 0 2.3-.6l-.9-2.8" />
        <path d="M19 9.5a3 3 0 0 1 0 5" />
    </Icon>
)

/** An ad link: two rings of a chain. */
export const LinkIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </Icon>
)
