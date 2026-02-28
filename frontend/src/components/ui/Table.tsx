import React from 'react'
import { CaretUp, CaretDown } from '@phosphor-icons/react'
import { cn } from '../../utils/cn'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
}

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (columnKey: string) => void
  emptyState?: React.ReactNode
  pagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    onPageChange: (page: number) => void
  }
  className?: string
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  sortColumn,
  sortDirection,
  onSort,
  emptyState,
  pagination,
  className,
}: TableProps<T>) {
  return (
    <div className={cn('w-full bg-white rounded-xl border border-border overflow-hidden shadow-card', className)}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg-subtle border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-[0.04em] whitespace-nowrap',
                    col.sortable && 'cursor-pointer hover:text-text-primary select-none'
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <div className="flex flex-col -space-y-1 opacity-50">
                        <CaretUp
                          size={12}
                          weight="bold"
                          className={cn(sortColumn === col.key && sortDirection === 'asc' && 'text-blue opacity-100')}
                        />
                        <CaretDown
                          size={12}
                          weight="bold"
                          className={cn(sortColumn === col.key && sortDirection === 'desc' && 'text-blue opacity-100')}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  {emptyState || (
                    <div className="text-text-secondary text-sm">No data available</div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="border-b border-border last:border-0 hover:bg-bg-subtle transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-sm text-text-primary">
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && data.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-white">
          <div className="text-sm text-text-secondary">
            {Math.min((pagination.currentPage - 1) * pagination.itemsPerPage + 1, pagination.totalItems)}–
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-text-primary border border-border rounded hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-1 text-sm font-medium text-text-primary border border-border rounded hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
