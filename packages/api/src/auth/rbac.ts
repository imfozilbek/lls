import { SetMetadata, Injectable, CanActivate, ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import type { FastifyRequest } from "fastify"

/**
 * Available roles in the system
 */
export enum Role {
    CUSTOMER = "customer",
    COURIER = "courier",
    BUSINESS = "business",
    ADMIN = "admin",
}

/**
 * Resource types for permission checks
 */
export enum Resource {
    BUSINESS = "business",
    PRODUCT = "product",
    ORDER = "order",
    CUSTOMER = "customer",
    COURIER = "courier",
    ANALYTICS = "analytics",
}

/**
 * Actions that can be performed on resources
 */
export enum Action {
    CREATE = "create",
    READ = "read",
    UPDATE = "update",
    DELETE = "delete",
    LIST = "list",
}

/**
 * Permission definition
 */
export interface Permission {
    resource: Resource
    action: Action
}

/**
 * Role-based permissions matrix
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.CUSTOMER]: [
        { resource: Resource.BUSINESS, action: Action.READ },
        { resource: Resource.BUSINESS, action: Action.LIST },
        { resource: Resource.PRODUCT, action: Action.READ },
        { resource: Resource.PRODUCT, action: Action.LIST },
        { resource: Resource.ORDER, action: Action.CREATE },
        { resource: Resource.ORDER, action: Action.READ },
        { resource: Resource.ORDER, action: Action.LIST },
        { resource: Resource.CUSTOMER, action: Action.READ },
        { resource: Resource.CUSTOMER, action: Action.UPDATE },
    ],
    [Role.COURIER]: [
        { resource: Resource.BUSINESS, action: Action.READ },
        { resource: Resource.BUSINESS, action: Action.LIST },
        { resource: Resource.ORDER, action: Action.READ },
        { resource: Resource.ORDER, action: Action.LIST },
        { resource: Resource.ORDER, action: Action.UPDATE },
        { resource: Resource.COURIER, action: Action.READ },
        { resource: Resource.COURIER, action: Action.UPDATE },
    ],
    [Role.BUSINESS]: [
        { resource: Resource.BUSINESS, action: Action.READ },
        { resource: Resource.BUSINESS, action: Action.UPDATE },
        { resource: Resource.PRODUCT, action: Action.CREATE },
        { resource: Resource.PRODUCT, action: Action.READ },
        { resource: Resource.PRODUCT, action: Action.UPDATE },
        { resource: Resource.PRODUCT, action: Action.DELETE },
        { resource: Resource.PRODUCT, action: Action.LIST },
        { resource: Resource.ORDER, action: Action.READ },
        { resource: Resource.ORDER, action: Action.UPDATE },
        { resource: Resource.ORDER, action: Action.LIST },
        { resource: Resource.ANALYTICS, action: Action.READ },
    ],
    [Role.ADMIN]: [
        // Admin has all permissions
        ...Object.values(Resource).flatMap((resource) =>
            Object.values(Action).map((action) => ({ resource, action })),
        ),
    ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
    const permissions = ROLE_PERMISSIONS[role]
    return permissions.some((p) => p.resource === resource && p.action === action)
}

/**
 * Decorator to require specific roles
 */
export const ROLES_KEY = "roles"
export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
    SetMetadata(ROLES_KEY, roles)

/**
 * Decorator to require specific permissions
 */
export const PERMISSIONS_KEY = "permissions"
export const RequirePermission = (
    resource: Resource,
    action: Action,
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSIONS_KEY, { resource, action })

/**
 * Guard that checks role-based access
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ])

        if (!requiredRoles || requiredRoles.length === 0) {
            return true
        }

        const request = context.switchToHttp().getRequest<FastifyRequest>()
        const user = (request as FastifyRequest & { user?: { role?: Role } }).user

        if (!user?.role) {
            return false
        }

        return requiredRoles.includes(user.role)
    }
}

/**
 * Guard that checks permission-based access
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ])

        if (!requiredPermission) {
            return true
        }

        const request = context.switchToHttp().getRequest<FastifyRequest>()
        const user = (request as FastifyRequest & { user?: { role?: Role } }).user

        if (!user?.role) {
            return false
        }

        return hasPermission(user.role, requiredPermission.resource, requiredPermission.action)
    }
}
