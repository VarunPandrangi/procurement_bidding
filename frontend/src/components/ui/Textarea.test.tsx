import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders correctly', () => {
    render(<Textarea placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Textarea label="Description" id="desc" />)
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('displays error message', () => {
    render(<Textarea error="Too short" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Too short')).toBeInTheDocument()
  })
})
