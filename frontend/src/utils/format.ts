export function formatCurrency(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate)
  const day = d.getDate().toString().padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const year = d.getFullYear()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${day} ${mon} ${year} · ${hh}:${mm}`
}

export function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const target = new Date(isoDate).getTime()
  const diffMs = target - now
  const absDiff = Math.abs(diffMs)
  const isPast = diffMs < 0

  if (absDiff < 60_000) return 'just now'

  const minutes = Math.floor(absDiff / 60_000)
  if (minutes < 60) {
    const label = minutes === 1 ? 'minute' : 'minutes'
    return isPast ? `${minutes} ${label} ago` : `in ${minutes} ${label}`
  }

  const hours = Math.floor(absDiff / 3_600_000)
  if (hours < 24) {
    const label = hours === 1 ? 'hour' : 'hours'
    return isPast ? `${hours} ${label} ago` : `in ${hours} ${label}`
  }

  const days = Math.floor(absDiff / 86_400_000)
  if (days < 30) {
    const label = days === 1 ? 'day' : 'days'
    return isPast ? `${days} ${label} ago` : `in ${days} ${label}`
  }

  const months = Math.floor(days / 30)
  const label = months === 1 ? 'month' : 'months'
  return isPast ? `${months} ${label} ago` : `in ${months} ${label}`
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
