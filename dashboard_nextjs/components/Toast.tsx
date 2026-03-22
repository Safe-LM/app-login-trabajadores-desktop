'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, WifiOff, RefreshCw } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'loading'

interface ToastProps {
  message: string
  type: ToastType
  visible: boolean
}

export default function Toast({ message, type, visible }: ToastProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
    } else {
      const t = setTimeout(() => setShow(false), 300)
      return () => clearTimeout(t)
    }
  }, [visible])

  if (!show) return null

  const icon =
    type === 'success' ? <CheckCircle size={14} style={{ color: 'var(--success)' }} /> :
    type === 'error'   ? <WifiOff     size={14} style={{ color: 'var(--danger)'  }} /> :
                         <RefreshCw   size={14} style={{ color: 'var(--accent)'  }} className="animate-spin" />

  const borderColor =
    type === 'success' ? 'rgba(34,197,94,0.3)'  :
    type === 'error'   ? 'rgba(239,68,68,0.3)'  :
                         'rgba(58,134,255,0.3)'

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-xl
        text-[12px] font-medium shadow-xl"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
        color: 'var(--text-primary)',
        backdropFilter: 'blur(16px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.25s, transform 0.25s',
      }}
    >
      {icon}
      {message}
    </div>
  )
}
