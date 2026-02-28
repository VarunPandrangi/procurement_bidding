import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react'
import { useAuthStore } from '../../store/authStore'
import { loginApi } from '../../api/auth.api'
import { Button } from '../../components/ui/Button'
import { BrandMark } from '../../components/layout/Sidebar'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const getRoleHome = (role: string) => {
    switch (role) {
      case 'ADMIN': return '/admin'
      case 'BUYER': return '/buyer'
      case 'SUPPLIER': return '/supplier'
      default: return '/login'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { accessToken, user: authUser } = await loginApi({ email, password })

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

      const destination = from || getRoleHome(authUser.role)
      navigate(destination, { replace: true })
    } catch (err: unknown) {
      const axiosError = err as { response?: { status: number; data?: { message?: string } } }

      if (axiosError.response?.status === 401) {
        setError('Incorrect email or password')
      } else if (axiosError.response?.status === 429) {
        setError('Too many attempts — please wait a few minutes')
      } else {
        setError('Something went wrong on our end — please try again')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-5">
      <div className="w-[420px] max-w-full bg-white rounded-[20px] shadow-xl border border-grey-200 p-12">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-6">
            <BrandMark size="large" />
          </div>
          <span className="text-[22px] font-bold text-text-primary tracking-tight">
            ProcureX
          </span>
        </div>

        <div className="h-px bg-grey-200 mb-7" />

        {/* Heading */}
        <h1 className="text-3xl text-text-primary tracking-[-0.025em] mb-1.5">
          Welcome back
        </h1>
        <p className="text-base text-text-secondary mb-8">
          Sign in to your account
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="mb-5">
            <label htmlFor="login-email" className="block text-sm font-medium text-text-primary mb-1.5">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-DEFAULT border border-border bg-white text-base text-text-primary placeholder:text-text-tertiary transition-all duration-150 ease-out outline-none focus:border-blue focus:ring-[3px] focus:ring-blue/30"
              placeholder="you@company.com"
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label htmlFor="login-password" className="block text-sm font-medium text-text-primary mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-DEFAULT border border-border bg-white text-base text-text-primary placeholder:text-text-tertiary transition-all duration-150 ease-out outline-none focus:border-blue focus:ring-[3px] focus:ring-blue/30"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-400 hover:text-grey-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeSlash size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-3 bg-red-light border border-[#FECACA] rounded-DEFAULT px-4 py-3 mb-5 animate-in slide-in-from-top-2 fade-in duration-200"
              role="alert"
            >
              <WarningCircle size={20} className="text-red shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-sm text-[#7F1D1D]">{error}</span>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
