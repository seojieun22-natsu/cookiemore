'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'

const ADMIN_PASSWORD = 'smore2024'

const LEVAIN_NAMES = [
  '쿠키앤모어 다크카카오 쿠키', '쿠키앤모어 용감한 쿠키', '쿠키앤모어 미스틱플라워 쿠키',
  '쿠키앤모어 천사맛 쿠키', '쿠키앤모어 홀리베리 쿠키', '쿠키앤모어 달빛술사 쿠키',
  '쿠키앤모어 골드치즈 쿠키', '쿠키앤모어 퓨어바닐라 쿠키', '쿠키앤모어 밀키웨이맛 쿠키',
  '쿠키앤모어 버닝스파이스 쿠키', '쿠키앤모어 이터널슈가 쿠키', '쿠키앤모어 쉐도우밀크 쿠키',
  '쿠키앤모어 좀비맛 쿠키', '쿠키앤모어 세인트릴리 쿠키', '쿠키앤모어 사일런트솔트 쿠키',
]

type Recipient = { id: number; label: string; phone: string }

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [showRecipients, setShowRecipients] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addingRecipient, setAddingRecipient] = useState(false)

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) { setAuthenticated(true); setAuthError('') }
    else setAuthError('비밀번호가 틀렸어요')
  }

  useEffect(() => {
    if (!authenticated) return

    supabase.from('cookie_items').select('*').order('id').then(({ data }) => {
      if (data) setProducts(data)
      setLoading(false)
    })

    fetch('/api/recipients').then((r) => r.json()).then(setRecipients)

    const channel = supabase.channel('admin-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cookie_items' }, (payload) => {
        setProducts((prev) => prev.map((p) => p.id === (payload.new as Product).id ? (payload.new as Product) : p))
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [authenticated])

  const notify = (names: string[], is_soldout: boolean, silent = false) =>
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, is_soldout, silent }),
    }).catch(() => {})

  const toggleSoldout = async (product: Product) => {
    const newStatus = !product.is_soldout
    const { error } = await supabase.from('cookie_items')
      .update({ is_soldout: newStatus, updated_at: new Date().toISOString() })
      .eq('id', product.id)
    if (error) { alert('업데이트 실패: ' + error.message); return }

    const updated = products.map((p) => p.id === product.id ? { ...p, is_soldout: newStatus } : p)
    setProducts(updated)

    if (newStatus) {
      await notify([product.name], true)
      const levain = updated.filter((p) => LEVAIN_NAMES.includes(p.name))
      if (levain.every((p) => p.is_soldout)) await notify(['[쿠키앤모어] ⚠️ 르뱅쿠키 전체 품절'], true)
      if (updated.every((p) => p.is_soldout)) await notify(['[쿠키앤모어] 🚨 전체 제품 품절'], true)
    }
  }

  const applyBatch = async (is_soldout: boolean) => {
    if (selected.size === 0) return
    setUpdating(true)
    const selectedProducts = products.filter((p) => selected.has(p.id))
    const now = new Date().toISOString()

    await Promise.all(
      selectedProducts.map((p) =>
        supabase.from('cookie_items').update({ is_soldout, updated_at: now }).eq('id', p.id)
      )
    )

    const updated = products.map((p) => selected.has(p.id) ? { ...p, is_soldout } : p)
    setProducts(updated)
    setSelected(new Set())

    const names = selectedProducts.filter((p) => p.is_soldout !== is_soldout || is_soldout).map((p) => p.name)
    await notify(names, is_soldout)

    if (is_soldout) {
      const levain = updated.filter((p) => LEVAIN_NAMES.includes(p.name))
      if (levain.every((p) => p.is_soldout)) await notify(['[쿠키앤모어] ⚠️ 르뱅쿠키 전체 품절'], true)
      if (updated.every((p) => p.is_soldout)) await notify(['[쿠키앤모어] 🚨 전체 제품 품절'], true)
    }
    setUpdating(false)
  }

  const resetAll = async () => {
    if (!confirm('전체 품목을 판매재개 상태로 초기화할까요?')) return
    setResetting(true)
    await supabase.from('cookie_items').update({ is_soldout: false, updated_at: new Date().toISOString() }).neq('id', 0)
    setProducts((prev) => prev.map((p) => ({ ...p, is_soldout: false })))
    setResetting(false)
  }

  const addRecipient = async () => {
    if (!newLabel || !newPhone) return
    setAddingRecipient(true)
    const res = await fetch('/api/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, phone: newPhone }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error) }
    else { setRecipients((prev) => [...prev, data]); setNewLabel(''); setNewPhone('') }
    setAddingRecipient(false)
  }

  const removeRecipient = async (id: number) => {
    await fetch(`/api/recipients/${id}`, { method: 'DELETE' })
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!authenticated) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-center text-gray-800 mb-6">🔒 스탭 전용</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="비밀번호 입력"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 mb-3" />
          {authError && <p className="text-red-500 text-xs mb-3">{authError}</p>}
          <button onClick={handleLogin} className="w-full bg-orange-400 hover:bg-orange-500 text-white font-semibold py-3 rounded-lg transition-colors">입장</button>
        </div>
      </main>
    )
  }

  const soldoutCount = products.filter((p) => p.is_soldout).length
  const levainProducts = products.filter((p) => LEVAIN_NAMES.includes(p.name))
  const setProductsList = products.filter((p) => !LEVAIN_NAMES.includes(p.name))

  const ProductCard = ({ product }: { product: Product }) => (
    <div
      onClick={() => toggleSelect(product.id)}
      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
        selected.has(product.id) ? 'border-orange-400 bg-orange-50' :
        product.is_soldout ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
      }`}
    >
      <input type="checkbox" checked={selected.has(product.id)} onChange={() => {}}
        className="shrink-0 w-4 h-4 accent-orange-400" />
      <span className={`text-sm font-medium flex-1 ${product.is_soldout ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
        {product.name}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); toggleSoldout(product) }}
        className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
          product.is_soldout ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'
        }`}
      >
        {product.is_soldout ? '재개' : '품절'}
      </button>
    </div>
  )

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800">🍪 재고 관리</h1>
        <a href="/" className="text-xs text-gray-400 hover:text-gray-600 underline">공개 페이지</a>
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {soldoutCount > 0 ? <span><span className="text-red-500 font-semibold">{soldoutCount}종 품절</span> / {products.length}종</span>
            : <span className="text-green-600 font-semibold">전체 판매중</span>}
        </p>
        <button onClick={resetAll} disabled={resetting || soldoutCount === 0}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors">
          {resetting ? '초기화 중...' : '전체 판매재개'}
        </button>
      </div>

      {/* 수신자 관리 */}
      <div className="mb-5 border border-gray-100 rounded-xl overflow-hidden">
        <button onClick={() => setShowRecipients((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
          <span>📱 문자 수신자 ({recipients.length}명)</span>
          <span>{showRecipients ? '▲' : '▼'}</span>
        </button>
        {showRecipients && (
          <div className="p-4 space-y-2">
            {recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{r.label} <span className="text-gray-400">{r.phone}</span></span>
                <button onClick={() => removeRecipient(r.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="이름 (예: 대표님)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="010-0000-0000"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
              <button onClick={addRecipient} disabled={addingRecipient || !newLabel || !newPhone}
                className="px-4 py-2 bg-orange-400 text-white text-sm rounded-lg hover:bg-orange-500 disabled:opacity-50 transition-colors">
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 일괄처리 바 */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-10 mb-4 flex items-center justify-between bg-orange-400 text-white rounded-xl px-4 py-3 shadow-lg">
          <span className="text-sm font-semibold">{selected.size}개 선택됨</span>
          <div className="flex gap-2">
            <button onClick={() => applyBatch(true)} disabled={updating}
              className="text-xs font-bold px-4 py-2 bg-white text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
              {updating ? '처리 중...' : '품절 처리'}
            </button>
            <button onClick={() => applyBatch(false)} disabled={updating}
              className="text-xs font-bold px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors">
              판매 재개
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-2 bg-orange-300 rounded-lg hover:bg-orange-200">✕</button>
          </div>
        </div>
      )}

      {/* 제품 목록 */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">불러오는 중...</div>
      ) : (
        <>
          <div className="mb-5">
            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 px-1">
              🥐 르뱅쿠키 ({levainProducts.filter((p) => p.is_soldout).length}/{levainProducts.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {levainProducts.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2 px-1">
              🎁 세트 ({setProductsList.filter((p) => p.is_soldout).length}/{setProductsList.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {setProductsList.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
