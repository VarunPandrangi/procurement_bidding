import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { XCircle } from '@phosphor-icons/react'
import { useAuthStore } from '../../store/authStore'
import { exchangeTokenApi } from '../../api/auth.api'
import { Spinner } from '../../components/ui/Spinner'
import { BrandMark } from '../../components/layout/Sidebar'

export function TokenLandingPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!token) {
      setFailed(true)
      return
    }

    let cancelled = false

    const exchange = async () => {
      try {
        const { accessToken, user: authUser } = await exchangeTokenApi(token)

        if (cancelled) return

        login(
          {
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.full_name,
            role: authUser.role,
            company_name: authUser.company_name,
            supplier_code: authUser.supplier_code,
          },
          accessToken
        )

        navigate('/supplier', { replace: true })
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    exchange()

    return () => {
      cancelled = true
    }
  }, [token, login, navigate])

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-6">
          <BrandMark size="large" />
        </div>
        <span className="text-[22px] font-bold text-text-primary tracking-tight">
          ProcureX
        </span>
      </div>

      {failed ? (
        <div className="flex flex-col items-center text-center max-w-[340px]">
          <XCircle size={48} weight="fill" className="text-red mb-4" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-text-primary mb-2">
            This link is no longer valid
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Access links expire after one use. Contact your buyer to request a new invitation.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Spinner size="lg" className="text-blue mb-4" />
          <p className="text-base text-text-secondary">
            Verifying your access link...
          </p>
        </div>
      )}
    </div>
  )
}
