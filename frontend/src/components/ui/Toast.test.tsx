import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToastContainer } from './Toast'
import { useToastStore, useToast } from '../../store/toastStore'

const TestComponent = () => {
  const { toast } = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Success Title', 'Success Message')}>
        Show Success
      </button>
      <ToastContainer />
    </div>
  )
}

describe('Toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders toast when triggered', () => {
    render(<TestComponent />)
    fireEvent.click(screen.getByText('Show Success'))
    
    expect(screen.getByText('Success Title')).toBeInTheDocument()
    expect(screen.getByText('Success Message')).toBeInTheDocument()
  })

  it('removes toast when close button is clicked', () => {
    render(<TestComponent />)
    fireEvent.click(screen.getByText('Show Success'))
    
    expect(screen.getByText('Success Title')).toBeInTheDocument()
    
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByText('Success Title')).not.toBeInTheDocument()
  })

  it('auto-dismisses toast after duration', () => {
    render(<TestComponent />)
    fireEvent.click(screen.getByText('Show Success'))
    
    expect(screen.getByText('Success Title')).toBeInTheDocument()
    
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    
    expect(screen.queryByText('Success Title')).not.toBeInTheDocument()
  })
})
