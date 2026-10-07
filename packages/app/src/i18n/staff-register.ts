import { staffUz } from "./staff.js"

import { registerStaff } from "./index.js"

/** Imported first by every staff chunk: their words join the dictionary before they render. */
registerStaff({ uz: staffUz })
