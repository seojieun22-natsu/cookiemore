'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'

export default function StatusPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial fetch
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

    // Realtime subscription
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">🍪 쿠키앤모어 재고현황</h1>
        <p className="text-sm text-gray-400">최종 업데이트: {formatTime(lastUpdated)}</p>
        {!loading && (
          <p className="text-sm text-gray-500 mt-1">
            전체 {products.length}종 중{' '}
            <span className="text-red-500 font-semibold">{soldoutCount}종 품절</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                product.is_soldout
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-green-200'
              }`}
            >
              <span
                className={`text-sm font-medium leading-snug flex-1 mr-3 ${
                  product.is_soldout ? 'text-gray-400 line-through' : 'text-gray-800'
                }`}
              >
                {product.name}
              </span>
              <span
                className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
                  product.is_soldout
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {product.is_soldout ? '품절' : '판매중'}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-300 mt-8">실시간 자동 업데이트</p>
    </main>
  )
}
