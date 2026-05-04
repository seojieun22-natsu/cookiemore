'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

const LEVAIN_NAMES = [
  '쿠키앤모어 다크카카오 쿠키', '쿠키앤모어 용감한 쿠키', '쿠키앤모어 미스틱플라워 쿠키',
  '쿠키앤모어 천사맛 쿠키', '쿠키앤모어 홀리베리 쿠키', '쿠키앤모어 달빛술사 쿠키',
  '쿠키앤모어 골드치즈 쿠키', '쿠키앤모어 퓨어바닐라 쿠키', '쿠키앤모어 밀키웨이맛 쿠키',
  '쿠키앤모어 버닝스파이스 쿠키', '쿠키앤모어 이터널슈가 쿠키', '쿠키앤모어 쉐도우밀크 쿠키',
  '쿠키앤모어 좀비맛 쿠키', '쿠키앤모어 세인트릴리 쿠키', '쿠키앤모어 사일런트솔트 쿠키',
]

export default function StatusPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [notifState, setNotifState] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('cookie_items')
        .select('*')
        .order('id')
      if (data) {
        setProducts(data)
        setLastUpdated(new Date())
      }
      setLoading(false)
    }

    fetchProducts()

    const channel = supabase
      .channel('products-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cookie_items' },
        (payload) => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === (payload.new as Product).id ? (payload.new as Product) : p
            )
          )
          setLastUpdated(new Date())
        }
      )
      .subscribe()

    // Check existing push subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        const existing = await reg.pushManager.getSubscription()
        if (existing) setNotifState('subscribed')
      })
    } else {
      setNotifState('unsupported')
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const subscribePush = async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setNotifState('denied')
      return
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    })
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    })
    setNotifState('subscribed')
  }

  const formatTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const soldoutCount = products.filter((p) => p.is_soldout).length
  const levainProducts = products.filter((p) => LEVAIN_NAMES.includes(p.name))
  const setProductsList = products.filter((p) => !LEVAIN_NAMES.includes(p.name))

  const ProductCard = ({ product }: { product: Product }) => (
    <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
      product.is_soldout ? 'bg-red-50 border-red-200' : 'bg-white border-green-200'
    }`}>
      <span className={`text-sm font-medium leading-snug flex-1 mr-3 ${
        product.is_soldout ? 'text-gray-400 line-through' : 'text-gray-800'
      }`}>{product.name}</span>
      <span className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
        product.is_soldout ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
      }`}>{product.is_soldout ? '품절' : '판매중'}</span>
    </div>
  )

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">🍪 쿠키앤모어 재고현황</h1>
        <p className="text-sm text-gray-400">최종 업데이트: {formatTime(lastUpdated)}</p>
        {!loading && (
          <p className="text-sm text-gray-500 mt-1">
            전체 {products.length}종 중{' '}
            <span className="text-red-500 font-semibold">{soldoutCount}종 품절</span>
          </p>
        )}
        {notifState === 'idle' && (
          <button onClick={subscribePush}
            className="mt-3 text-xs px-4 py-2 rounded-full bg-orange-50 text-orange-500 border border-orange-200 hover:bg-orange-100 transition-colors">
            🔔 품절 알림 받기
          </button>
        )}
        {notifState === 'subscribed' && <p className="mt-3 text-xs text-green-600">🔔 알림 구독 중</p>}
        {notifState === 'denied' && <p className="mt-3 text-xs text-gray-400">알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.</p>}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">불러오는 중...</div>
      ) : (
        <>
          <div className="mb-5">
            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 px-1">
              🥐 르뱅쿠키 ({levainProducts.filter((p) => p.is_soldout).length}/{levainProducts.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {levainProducts.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2 px-1">
              🎁 세트 ({setProductsList.filter((p) => p.is_soldout).length}/{setProductsList.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {setProductsList.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </>
      )}

      <p className="text-center text-xs text-gray-300 mt-8">실시간 자동 업데이트</p>
    </main>
  )
}
