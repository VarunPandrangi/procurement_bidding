import React, { useEffect } from 'react'
import { X, CheckCircle, WarningCircle, Info, Warning } from '@phosphor-icons/react'
import { useToastStore, type Toast as ToastType } from '../../store/toastStore'
import { cn } from '../../utils/cn'

const ToastItem: React.FC<{ toast: ToastType }> = ({ toast }) => {
  const removeToast = useToastStore((state) => state.removeToast)

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        removeToast(toast.id)
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast, removeToast])

  const icons = {
    success: <CheckCircle size={20} weight="fill" className="text-green" />,
    error: <WarningCircle size={20} weight="fill" className="text-red" />,
    warning: <Warning size={20} weight="fill" className="text-yellow" />,
    info: <Info size={20} weight="fill" className="text-blue" />,
  }

  const borderColors = {
    success: 'border-l-green',
    error: 'border-l-red',
    warning: 'border-l-yellow',
    info: 'border-l-blue',
  }

  return (
    <div
      className={cn(
        'w-[320px] bg-white rounded-xl shadow-modal border-l-4 p-4 flex items-start gap-3 pointer-events-auto',
        'animate-in slide-in-from-right-full fade-in duration-300',
        borderColors[toast.type]
      )}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm text-text-secondary">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
