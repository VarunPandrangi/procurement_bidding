import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

interface UseWebSocketOptions {
  rfqId: string
  enabled?: boolean
  onRankingUpdate?: (data: unknown) => void
  onDeadlineExtended?: (data: { new_deadline: string; extension_minutes: number }) => void
  onClosed?: () => void
  onReconnect?: () => void
}

export function useWebSocket({ rfqId, enabled = true, onRankingUpdate, onDeadlineExtended, onClosed, onReconnect }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const hasConnectedOnce = useRef(false)
  const token = useAuthStore((s) => s.accessToken)

  const onRankingUpdateRef = useRef(onRankingUpdate)
  onRankingUpdateRef.current = onRankingUpdate
  const onDeadlineExtendedRef = useRef(onDeadlineExtended)
  onDeadlineExtendedRef.current = onDeadlineExtended
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    if (!enabled || !token || !rfqId) return

    const baseUrl = import.meta.env.VITE_API_URL || ''
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      setIsReconnecting(false)
      socket.emit('subscribe:rfq', { rfqId })
      // Refetch state on reconnect to catch missed events
      if (hasConnectedOnce.current) {
        onReconnectRef.current?.()
      }
      hasConnectedOnce.current = true
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('reconnect_attempt', () => {
      setIsReconnecting(true)
    })

    socket.on('ranking:updated', (data: unknown) => {
      onRankingUpdateRef.current?.(data)
    })

    socket.on('rfq:deadline_extended', (data: { new_deadline: string; extension_minutes: number }) => {
      onDeadlineExtendedRef.current?.(data)
    })

    socket.on('rfq:closed', () => {
      onClosedRef.current?.()
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      hasConnectedOnce.current = false
      setIsConnected(false)
      setIsReconnecting(false)
    }
  }, [rfqId, enabled, token])

  return { isConnected, isReconnecting }
}
