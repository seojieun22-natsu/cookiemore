'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'

const ADMIN_PASSWORD = 'smore2024'

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setError('')
    } else {
      setError('비밀번호가 틀렸어요')
    }
  }

  useEffect(() => {
    if (!authenticated) return

    const fetchProducts = async () => {
      const { data } = await supabase
        .from('cookie_items')
        .select('*')
        .order('id')
      if (data) setProducts(data)
      setLoading(false)
    }

    fetchProducts()

    const channel = supabase
      .channel('admin-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cookie_items' },
        (payload) => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === (payload.new as Product).id ? (payload.new as Product) : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authenticated])

  const toggleSoldout = async (product: Product) => {
    setUpdating(product.id)
    const { error } = await supabase
      .from('cookie_items')
      .update({
        is_soldout: !product.is_soldout,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)

    if (error) {
      alert('업데이트 실패: ' + error.message)
    }
    setUpdating(null)
  }

  if (!authenticated) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-center text-gray-800 mb-6">🔒 스탭 전용</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호 입력"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 mb-3"
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            입장
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🍪 재고 관리</h1>
        <a
          href="/"
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          공개 페이지 보기
        </a>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {products.map((product) => (
            <div
              key={product.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                product.is_soldout
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-100'
              }`}
            >
              <span
                className={`text-sm font-medium flex-1 mr-3 ${
                  product.is_soldout ? 'text-gray-400 line-through' : 'text-gray-800'
                }`}
              >
                {product.name}
              </span>
              <button
                onClick={() => toggleSoldout(product)}
                disabled={updating === product.id}
                className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  product.is_soldout
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                {updating === product.id
                  ? '...'
                  : product.is_soldout
                  ? '판매 재개'
                  : '품절 처리'}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
