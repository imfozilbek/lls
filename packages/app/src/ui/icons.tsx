import type { ReactNode, SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/** One hand-tuned 24px stroke set: rounded caps, 1.75 stroke, no fills. */
function Icon({
    size = 22,
    children,
    ...props
}: IconProps & { children: ReactNode }): React.JSX.Element {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {children}
        </svg>
    )
}

export const SearchIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
    </Icon>
)
export const PlusIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M12 5v14M5 12h14" />
    </Icon>
)
export const MinusIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M5 12h14" />
    </Icon>
)
export const BagIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8z" />
        <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </Icon>
)
export const ReceiptIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
    </Icon>
)
export const AlertIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M12 4 2.5 20h19z" />
        <path d="M12 10v4M12 17h.01" />
    </Icon>
)
export const MoreIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />
    </Icon>
)
export const StoreIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M4 10v10h16V10" />
        <path d="M3 10l2-6h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0" />
        <path d="M10 20v-5h4v5" />
    </Icon>
)
export const ClockIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
    </Icon>
)
export const PinIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.3" />
    </Icon>
)
export const PhoneIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2.1-2.2z" />
    </Icon>
)
export const CheckIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M5 12.5l4.2 4.2L19 7" />
    </Icon>
)
export const CloseIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
)
export const ChevronIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M9.5 6l6 6-6 6" />
    </Icon>
)
export const ChefIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M7 14.5V20h10v-5.5" />
        <path d="M7 14.5a4 4 0 0 1-1.2-7.7A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 6.2 2.8A4 4 0 0 1 17 14.5z" />
        <path d="M7 17h10" />
    </Icon>
)
export const BoxIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M3.5 8L12 4l8.5 4v8L12 20l-8.5-4z" />
        <path d="M3.5 8L12 12l8.5-4M12 12v8" />
    </Icon>
)
/** A wrench: services are done, not cooked or collected. */
export const ToolIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z" />
        <path d="M17 3.5l3.5 3.5" />
    </Icon>
)
/** A shop front with an awning: a grocery store. */
export const ShopFrontIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M4 10v10h16V10" />
        <path d="M3 10l1.5-5h15L21 10a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
        <path d="M10 20v-5h4v5" />
    </Icon>
)
/** A covered dish: a restaurant. */
export const DishIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M4 16a8 8 0 0 1 16 0z" />
        <path d="M3 19h18M12 8V6M10.5 6h3" />
    </Icon>
)
export const ScooterIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <circle cx="6" cy="17" r="2.5" />
        <circle cx="18" cy="17" r="2.5" />
        <path d="M8.5 17h6.5l2-7h-4M13 6h3l1 4M4 13h5l2 4" />
    </Icon>
)
export const HeartHomeIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M4 11l8-6.5 8 6.5V20H4z" />
        <path d="M12 17.5s-3-1.9-3-3.9a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.9-3 3.9z" />
    </Icon>
)
export const ImageIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="M20.5 16l-5-5-8 8.5" />
    </Icon>
)
export const TrashIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M4.5 7h15M10 11v6M14 11v6M9 7l1-3h4l1 3M6.5 7l1 13h9l1-13" />
    </Icon>
)
export const ListIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
        <circle cx="4.5" cy="12" r="0.6" fill="currentColor" />
        <circle cx="4.5" cy="18" r="0.6" fill="currentColor" />
    </Icon>
)
export const ChartIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
)
export const GearIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2" />
        <circle cx="12" cy="12" r="6.7" />
    </Icon>
)
export const CopyIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <rect x="8" y="8" width="12" height="12" rx="2.5" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
)
export const BotIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <rect x="4" y="8" width="16" height="11" rx="3.5" />
        <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5" />
    </Icon>
)
export const WifiOffIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.3M19 12.9a10 10 0 0 0-2-1.4M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-10.5-4.2" />
        <circle cx="12" cy="20" r="0.6" fill="currentColor" />
    </Icon>
)

export const CashIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5v.01M18 14.5v.01" />
    </Icon>
)
export const CardIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6.5 15h4" />
    </Icon>
)
/** «Platforma»: a shield with a check, the admins' section. */
export const ShieldIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M12 3.5 5 6v5.2c0 4.3 2.9 7.9 7 9.3 4.1-1.4 7-5 7-9.3V6l-7-2.5Z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
    </Icon>
)
export const QrIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
        <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
        <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
        <path d="M14 14h2.5v2.5M20.5 14v.01M14 20.5h.01M17.5 20.5h3v-3" />
    </Icon>
)

/** Placeholder art for products without a photo, one per shared category. */
const CATEGORY_PATHS: Record<string, ReactNode> = {
    meals: (
        <path d="M3 12h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" />
    ),
    soups: <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0zM9 20h6M17 6l3-3" />,
    salads: <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0zM8 11c0-3 2-5 5-5M12 11c1-2 3-3 5-3" />,
    grill: <path d="M5 19L19 5M8 16l-2-2M11 13l-2-2M14 10l-2-2M17 7l-2-2" />,
    pizza: <path d="M12 21L3.5 6.5a17 17 0 0 1 17 0zM9 10h.01M13 13h.01M14 8h.01" />,
    burgers: <path d="M4 10a8 5 0 0 1 16 0zM4 14h16M5 17h14v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />,
    bakery: (
        <path d="M4 14c0-5 3.5-9 8-9s8 4 8 9v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 9l1 4M15 9l-1 4" />
    ),
    desserts: <path d="M5 11h14l-2 9H7zM6 11a6 6 0 0 1 12 0M12 5V3" />,
    drinks: <path d="M7 4h10l-1.5 16h-7zM7.4 9h9.2M14 4l2-2" />,
    water: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
    dairy: <path d="M9 3h6v3l2 3v12H7V9l2-3zM7 13h10" />,
    meat: <path d="M15 4a5 5 0 0 1 3.5 8.5l-6 6a4 4 0 0 1-5.7-5.7l6-6A5 5 0 0 1 15 4zM6 18l-2 2" />,
    produce: <path d="M12 8c-4 0-7 3-7 7s3 6 7 6 7-2 7-6-3-7-7-7zM12 8V4M12 6c1-2 3-2 4-2" />,
    groceries: <path d="M3 5h2l2.5 11h11l2-8H7M9 20h.01M17 20h.01" />,
    household: <path d="M9 3h5v4l3 3v11H7V10l2-3zM14 5h3" />,
    cleaning: <path d="M12 3v9M8 21l1-9h6l1 9zM9.5 16.5h5M18 4l1 1M20 7h1" />,
    car_care: <path d="M5 16h14v-3l-2-5H7l-2 5zM5 16v2M19 16v2M7.5 13h.01M16.5 13h.01" />,
    repair: <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z" />,
    beauty: (
        <path d="M7 4l5 9 5-9M9 20a3 3 0 1 1 0-.01M15 20a3 3 0 1 1 0-.01M10.5 15.5l1.5-2.5 1.5 2.5" />
    ),
    other: <path d="M4 12l8-8h8v8l-8 8zM15.5 8.5h.01" />,
    hot_drinks: (
        <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
    ),
    fish: <path d="M3 12c3-4 8-5 12-3l4-3v12l-4-3c-4 2-9 1-12-3zM8 11.5h.01" />,
    spices: <path d="M8 3h8v3H8zM7 6h10l1 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9zM9 13h6" />,
    frozen: (
        <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />
    ),
    kitchenware: <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h2M20 10h2M9 6h6M12 6V4" />,
    clothes: <path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c0 2-1.5 3-4 3S8 5 8 3z" />,
    electrical: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />,
    stationery: <path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4" />,
    flowers: (
        <path d="M12 12v9M12 12a3 3 0 1 1 0-6 3 3 0 1 1 0 6zM8 17c2 0 4 1 4 3M16 16c-2 0-4 1-4 3" />
    ),
    building: <path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6" />,
    gas: <path d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7z" />,
    moving: <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01" />,
}

/** A category without its own picture borrows the one of its nearest neighbour. */
const CATEGORY_LOOKS_LIKE: Record<string, string> = {
    osh: "meals",
    dough: "meals",
    asian: "meals",
    european: "meals",
    breakfast: "meals",
    sides: "meals",
    combo: "meals",
    ready_food: "meals",
    catering: "meals",
    lavash: "burgers",
    chicken: "meat",
    poultry: "meat",
    deli: "meat",
    sushi: "fish",
    sauces: "spices",
    cakes: "desserts",
    national_sweets: "desserts",
    ice_cream: "desserts",
    sweets: "desserts",
    cookies: "desserts",
    honey: "desserts",
    snacks: "desserts",
    coffee: "hot_drinks",
    tea: "hot_drinks",
    fresh: "drinks",
    milk_drinks: "drinks",
    juices: "drinks",
    greens: "produce",
    dried_fruits: "produce",
    nuts: "produce",
    cheese: "dairy",
    eggs: "dairy",
    flour: "groceries",
    rice: "groceries",
    grains: "groceries",
    pasta: "groceries",
    oils: "groceries",
    sugar_salt: "groceries",
    canned: "groceries",
    pickles: "groceries",
    baby_food: "groceries",
    chemicals: "household",
    hygiene: "household",
    cosmetics: "beauty",
    baby_goods: "household",
    paper: "household",
    pets: "household",
    textile: "clothes",
    tailoring: "clothes",
    appliances: "electrical",
    electrician: "electrical",
    gadgets: "electrical",
    phone_goods: "electrical",
    printing: "stationery",
    lessons: "stationery",
    documents: "stationery",
    garden: "flowers",
    yard: "flowers",
    farming: "flowers",
    paint: "building",
    fasteners: "building",
    construction: "building",
    windows: "building",
    tools: "repair",
    plumbing: "repair",
    plumber: "repair",
    welding: "repair",
    climate: "repair",
    furniture: "repair",
    workshop: "repair",
    auto_goods: "car_care",
    car_wash: "car_care",
    tyres: "car_care",
    transport: "moving",
    carpet: "cleaning",
    laundry: "cleaning",
    wells: "water",
    barber: "beauty",
    massage: "beauty",
}

export function CategoryIcon({
    category,
    ...p
}: IconProps & { category: string }): React.JSX.Element {
    const own = CATEGORY_PATHS[category] ?? CATEGORY_PATHS[CATEGORY_LOOKS_LIKE[category] ?? ""]
    return <Icon {...p}>{own ?? CATEGORY_PATHS["other"]}</Icon>
}
