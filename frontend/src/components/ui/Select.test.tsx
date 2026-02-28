import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Select } from './Select'

const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
]

describe('Select', () => {
  it('renders with placeholder', () => {
    render(<Select options={options} placeholder="Choose one" />)
    expect(screen.getByText('Choose one')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<Select options={options} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('calls onChange when option is selected', () => {
    const handleChange = vi.fn()
    render(<Select options={options} onChange={handleChange} />)
    
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Option 2'))
    
    expect(handleChange).toHaveBeenCalledWith('2')
  })

  it('shows search input when options > 8', () => {
    const manyOptions = Array.from({ length: 10 }, (_, i) => ({
      value: `${i}`,
      label: `Option ${i}`,
    }))
    
    render(<Select options={manyOptions} />)
    fireEvent.click(screen.getByRole('combobox'))
    
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })
})
