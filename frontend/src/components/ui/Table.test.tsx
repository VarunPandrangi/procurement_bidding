import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Table, Column } from './Table'

interface TestItem {
  id: string
  name: string
}

const columns: Column<TestItem>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
]

const data: TestItem[] = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
]

describe('Table', () => {
  it('renders headers and data', () => {
    render(<Table data={data} columns={columns} keyExtractor={(item) => item.id} />)
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<Table<TestItem> data={[]} columns={columns} keyExtractor={(item) => item.id} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('calls onSort when sortable header is clicked', () => {
    const handleSort = vi.fn()
    render(
      <Table
        data={data}
        columns={columns}
        keyExtractor={(item) => item.id}
        onSort={handleSort}
      />
    )
    fireEvent.click(screen.getByText('Name'))
    expect(handleSort).toHaveBeenCalledWith('name')
  })
})
