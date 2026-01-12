import { cn } from "../../lib/utils.js"

import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from "react"

interface TableProps extends HTMLAttributes<HTMLTableElement> {
    children: ReactNode
}

export function Table({ children, className, ...props }: TableProps): ReactNode {
    return (
        <div className="overflow-x-auto">
            <table className={cn("min-w-full divide-y divide-gray-200", className)} {...props}>
                {children}
            </table>
        </div>
    )
}

interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
    children: ReactNode
}

export function TableHeader({ children, className, ...props }: TableHeaderProps): ReactNode {
    return (
        <thead className={cn("bg-gray-50", className)} {...props}>
            {children}
        </thead>
    )
}

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
    children: ReactNode
}

export function TableBody({ children, className, ...props }: TableBodyProps): ReactNode {
    return (
        <tbody className={cn("divide-y divide-gray-200 bg-white", className)} {...props}>
            {children}
        </tbody>
    )
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
    children: ReactNode
    hoverable?: boolean
}

export function TableRow({
    children,
    hoverable = true,
    className,
    ...props
}: TableRowProps): ReactNode {
    return (
        <tr className={cn(hoverable && "hover:bg-gray-50", className)} {...props}>
            {children}
        </tr>
    )
}

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
    children?: ReactNode
}

export function TableHead({ children, className, ...props }: TableHeadProps): ReactNode {
    return (
        <th
            className={cn(
                "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                className,
            )}
            {...props}
        >
            {children}
        </th>
    )
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
    children?: ReactNode
}

export function TableCell({ children, className, ...props }: TableCellProps): ReactNode {
    return (
        <td className={cn("px-4 py-3 text-sm text-gray-900", className)} {...props}>
            {children}
        </td>
    )
}

interface EmptyStateProps {
    icon?: ReactNode
    title: string
    description?: string
    action?: ReactNode
}

export function TableEmptyState({ icon, title, description, action }: EmptyStateProps): ReactNode {
    return (
        <tr>
            <td colSpan={100} className="px-4 py-12 text-center">
                {icon && <div className="text-4xl mb-3">{icon}</div>}
                <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
                {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
                {action}
            </td>
        </tr>
    )
}
