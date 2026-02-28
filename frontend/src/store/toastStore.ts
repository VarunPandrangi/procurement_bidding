import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-3), // Keep max 3
    }))
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export const useToast = () => {
  const addToast = useToastStore((state) => state.addToast)

  return {
    toast: {
      success: (title: string, message?: string, duration = 4000) =>
        addToast({ type: 'success', title, message, duration }),
      error: (title: string, message?: string, duration = 6000) =>
        addToast({ type: 'error', title, message, duration }),
      warning: (title: string, message?: string, duration = 8000) =>
        addToast({ type: 'warning', title, message, duration }),
      info: (title: string, message?: string, duration?: number) =>
        addToast({ type: 'info', title, message, duration }),
    },
  }
}
