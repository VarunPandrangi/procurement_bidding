import { useNavigate } from 'react-router-dom'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()

  const handleBack = () => {
    if (isAuthenticated && user) {
      switch (user.role) {
        case 'ADMIN':
          navigate('/admin')
          break
        case 'BUYER':
          navigate('/buyer')
          break
        case 'SUPPLIER':
          navigate('/supplier')
          break
        default:
          navigate('/login')
      }
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-5">
      <MagnifyingGlass size={64} weight="duotone" className="text-grey-300 mb-4" aria-hidden="true" />
      <h1 className="text-xl text-text-primary mb-1.5">
        Page not found
      </h1>
      <p className="text-base text-text-secondary text-center max-w-[360px] mb-6">
        The page you're looking for doesn't exist or you don't have access to it.
      </p>
      <Button onClick={handleBack}>
        Back to Dashboard
      </Button>
    </div>
  )
}
