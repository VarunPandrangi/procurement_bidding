import api from './axios'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: 'ADMIN' | 'BUYER' | 'SUPPLIER'
  is_active: boolean
  supplier_code?: string | null
  company_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface LoginResponse {
  success: boolean
  data: {
    accessToken: string
    user: AuthUser
  }
}

export interface RefreshResponse {
  success: boolean
  data: {
    accessToken: string
  }
}

export interface MeResponse {
  success: boolean
  data: AuthUser & {
    supplier?: {
      id: string
      company_name: string
      unique_code: string
      credibility_score?: number
      credibility_class?: string
    }
  }
}

export async function loginApi(credentials: LoginCredentials): Promise<LoginResponse['data']> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', credentials)
  return data.data
}

export async function refreshApi(): Promise<string> {
  const { data } = await api.post<RefreshResponse>('/api/auth/refresh')
  return data.data.accessToken
}

export async function logoutApi(): Promise<void> {
  try {
    await api.post('/api/auth/logout')
  } catch {
    // Fire-and-forget — don't block logout on server error
  }
}

export async function getMeApi(): Promise<MeResponse['data']> {
  const { data } = await api.get<MeResponse>('/api/auth/me')
  return data.data
}

export async function exchangeTokenApi(token: string): Promise<LoginResponse['data']> {
  const { data } = await api.post<LoginResponse>(`/api/auth/token-exchange`, { token })
  return data.data
}
