/**
 * The 14 regions of Uzbekistan a district belongs to (owner's decision, October 2026): 12
 * viloyats, the Republic of Karakalpakstan and the city of Tashkent, in the official order.
 * The values are stored, so they are only added, never renamed.
 */
export enum Region {
    QORAQALPOGISTON = "qoraqalpogiston",
    ANDIJON = "andijon",
    BUXORO = "buxoro",
    JIZZAX = "jizzax",
    QASHQADARYO = "qashqadaryo",
    NAVOIY = "navoiy",
    NAMANGAN = "namangan",
    SAMARQAND = "samarqand",
    SURXONDARYO = "surxondaryo",
    SIRDARYO = "sirdaryo",
    TOSHKENT_VILOYATI = "toshkent_viloyati",
    FARGONA = "fargona",
    XORAZM = "xorazm",
    TOSHKENT_SHAHRI = "toshkent_shahri",
}

export const REGIONS: readonly Region[] = Object.values(Region)
