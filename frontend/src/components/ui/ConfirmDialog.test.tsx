import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders correctly when open', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm and shows loading state', async () => {
    const handleConfirm = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    
    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    fireEvent.click(confirmButton)
    
    expect(handleConfirm).toHaveBeenCalledTimes(1)
    expect(confirmButton).toHaveAttribute('aria-busy', 'true')
    
    await waitFor(() => {
      expect(confirmButton).not.toHaveAttribute('aria-busy', 'true')
    })
  })
})
