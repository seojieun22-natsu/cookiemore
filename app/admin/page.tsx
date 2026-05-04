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
  const [resetting, setResetting] = useState(false)
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
    const newStatus = !product.is_soldout
    const { error } = await supabase
      .from('cookie_items')
      .update({
        is_soldout: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)

    if (error) {
      alert('업데이트 실패: ' + error.message)
    } else {
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, is_soldout: newStatus } : p)
      )
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: product.name, is_soldout: newStatus }),
      }).catch(() => {})
    }
    setUpdating(null)
  }

  const resetAll = async () => {
    if (!confirm('전체 품목을 판매재개 상태로 초기화할까요?')) return
    setResetting(true)
    const { error } = await supabase
      .from('cookie_items')
      .update({ is_soldout: false, updated_at: new Date().toISOString() })
      .neq('id', 0)

    if (error) {
      alert('초기화 실패: ' + error.message)
    } else {
      setProducts((prev) => prev.map((p) => ({ ...p, is_soldout: false })))
    }
    setResetting(false)
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

  const soldoutCount = products.filter((p) => p.is_soldout).length

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800">🍪 재고 관리</h1>
        <a href="/" className="text-xs text-gray-400 hover:text-gray-600 underline">
          공개 페이지 보기
        </a>
      </div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {soldoutCount > 0 ? (
            <span><span className="text-red-500 font-semibold">{soldoutCount}종 품절</span> / 전체 {products.length}종</span>
          ) : (
            <span className="text-green-600 font-semibold">전체 판매중</span>
          )}
        </p>
        <button
          onClick={resetAll}
          disabled={resetting || soldoutCount === 0}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          {resetting ? '초기화 중...' : '전체 판매재개'}
        </button>
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
