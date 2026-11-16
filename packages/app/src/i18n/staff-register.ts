import { BusinessType } from "@zumda/core"

import { FOOD_STAFF, SERVICE_STAFF } from "./kind-staff.js"
import { staffUz } from "./staff.js"

import { registerStaff } from "./index.js"

import type { StaffOverlays } from "./index.js"

/** Imported first by every staff chunk: their words join the dictionary before they render. */
registerStaff({ uz: staffUz }, {
    [BusinessType.FOOD]: FOOD_STAFF,
    [BusinessType.SERVICE]: SERVICE_STAFF,
} as StaffOverlays)
