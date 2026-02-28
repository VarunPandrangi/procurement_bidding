import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders correctly with variant', () => {
    render(<Badge variant="ACTIVE" />)
    const badge = screen.getByText('ACTIVE')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-light text-green')
  })

  it('renders DRAFT variant', () => {
    render(<Badge variant="DRAFT" />)
    expect(screen.getByText('DRAFT')).toHaveClass('bg-bg-subtle text-grey-600')
  })
})
