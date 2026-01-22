import { SetMetadata } from "@nestjs/common"

import { BUSINESS_AUTH_MODE_KEY, type BusinessAuthModeType } from "../guards/business-auth.guard.js"

export const BusinessAuthMode = (mode: BusinessAuthModeType): ReturnType<typeof SetMetadata> =>
    SetMetadata(BUSINESS_AUTH_MODE_KEY, mode)
