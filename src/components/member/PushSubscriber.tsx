'use client'

import { useEffect, useState } from 'react'

export default function PushSubscriber({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    navigator.serviceWorker.register('/sw.js')
    checkSubscription()
  }, [])

  async function checkSubscription() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) setStatus('subscribed')
    else if (Notification.permission === 'denied') setStatus('denied')
  }

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      setStatus('subscribed')
    } catch {
      setStatus('denied')
    }
  }

  if (status === 'unsupported' || status === 'subscribed' || status === 'denied') return null

  return (
    <button
      onClick={subscribe}
      className="w-full flex items-center justify-center gap-2 py-3 bg-orange-50 border border-orange-200 rounded-2xl text-sm text-orange-700 hover:bg-orange-100 transition-colors"
    >
      <span>🔔</span>
      開啟新週計畫通知
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
