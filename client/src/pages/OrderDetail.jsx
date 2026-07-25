import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'

const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 active:bg-primary-100 transition-colors">
      {copied ? '✅ Nusxalandi' : `📋 ${label || 'Nusxa olish'}`}
    </button>
  )
}

function parseToUTCTimestamp(dateStr) {
  if (!dateStr) return NaN
  if (typeof dateStr === 'number') return dateStr
  const clean = String(dateStr).replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/i, '').trim()
  const match = clean.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return NaN
  const [, y, m, d, h, min, s] = match.map(Number)
  return Date.UTC(y, m - 1, d, h - 5, min, s)
}

function useCountdown(createdAt) {
  const [remaining, setRemaining] = useState(0)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!createdAt) return
    const createdTime = parseToUTCTimestamp(createdAt)
    if (isNaN(createdTime)) return
    const endTime = createdTime + PAYMENT_TIMEOUT_MS
    const tick = () => {
      const diff = endTime - Date.now()
      if (diff <= 0) { setRemaining(0); setExpired(true); return }
      setRemaining(diff)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [createdAt])

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return { mins, secs, expired }
}

/* ── Star rating component ── */
function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange && onChange(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`text-3xl transition-transform ${!readonly ? 'active:scale-90' : ''}`}
          style={{ color: n <= (hover || value) ? '#f59e0b' : '#d1d5db', lineHeight: 1 }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/* ── Review Modal ── */
function ReviewModal({ order, user, onClose, onSuccess }) {
  const [stars, setStars] = useState(5)
  const [text, setText] = useState('')
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!text.trim() || text.trim().length < 10)
      return setError('Sharh kamida 10 ta belgi bo\'lishi kerak')
    setLoading(true)
    setError('')
    try {
      await axios.post('/api/reviews', {
        order_id: order.id,
        stars,
        text: text.trim(),
        author_name: user ? `${user.first_name || ''}`.trim() || 'Foydalanuvchi' : 'Foydalanuvchi',
        region: region.trim() || null,
      })
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.error || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full rounded-t-3xl p-5 bg-tg-bg animate-slide-up" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="w-10 h-1 rounded-full bg-tg-text/20 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-tg-text mb-1">Sharh yozing</h2>
        <p className="text-xs text-tg-hint mb-4">Xizmatimiz haqida fikringizni bildiring</p>

        {/* Stars */}
        <div className="mb-4 text-center">
          <p className="text-xs text-tg-hint mb-2">Baholang:</p>
          <StarRating value={stars} onChange={setStars} />
          <p className="text-sm font-semibold text-amber-500 mt-1">
            {['','Juda yomon','Yomon','O\'rtacha','Yaxshi','A\'lo!'][stars]}
          </p>
        </div>

        {/* Text */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-tg-hint uppercase tracking-wide block mb-1.5">Sharhingiz *</label>
          <textarea
            className="w-full rounded-xl border border-tg-text/10 bg-tg-secondary p-3 text-sm text-tg-text resize-none"
            rows={4}
            maxLength={500}
            placeholder="Xizmat haqida fikringizni yozing..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <p className="text-[10px] text-tg-hint text-right mt-0.5">{text.length}/500</p>
        </div>

        {/* Region */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-tg-hint uppercase tracking-wide block mb-1.5">Viloyat/Shahar (ixtiyoriy)</label>
          <input
            className="w-full rounded-xl border border-tg-text/10 bg-tg-secondary p-3 text-sm text-tg-text"
            placeholder="Masalan: Toshkent viloyati"
            value={region}
            onChange={e => setRegion(e.target.value)}
            maxLength={60}
          />
        </div>

        {error && <p className="text-xs text-rose-500 mb-3 bg-rose-50 rounded-lg p-2">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-bold text-sm text-white active:scale-[.97] transition-transform"
          style={{ background: loading ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
        >
          {loading ? 'Yuklanmoqda...' : 'Sharh yuborish →'}
        </button>
        <button onClick={onClose} className="w-full py-2.5 mt-2 rounded-2xl text-sm text-tg-hint">
          Bekor qilish
        </button>
      </div>
    </div>
  )
}

const statusMap = {
  pending_payment: { label: "To'lov kutilmoqda", color: 'bg-amber-100 text-amber-700', icon: '💳', desc: "Iltimos, to'lovni amalga oshiring" },
  pending_confirmation: { label: "Tekshirilmoqda", color: 'bg-sky-100 text-sky-700', icon: '🔍', desc: "To'lovingiz tekshirilmoqda" },
  in_progress: { label: 'Tayyorlanmoqda', color: 'bg-violet-100 text-violet-700', icon: '📝', desc: "Hujjat tayyorlanmoqda" },
  ready: { label: 'Tayyor', color: 'bg-emerald-100 text-emerald-700', icon: '✅', desc: "Hujjat tayyor! Tez orada yuboriladi" },
  sent: { label: 'Yuborildi', color: 'bg-emerald-100 text-emerald-700', icon: '📤', desc: "Hujjat sizga yuborildi" },
  rejected: { label: 'Rad etildi', color: 'bg-rose-100 text-rose-700', icon: '❌', desc: "To'lov rad etildi" },
}

function OrderDetail({ user }) {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)

  const countdown = useCountdown(order?.status === 'pending_payment' ? order?.created_at : null)

  useEffect(() => {
    Promise.all([
      axios.get(`/api/orders/${orderId}`),
      axios.get('/api/user/active-cards'),
    ]).then(([orderRes, cardsRes]) => {
      setOrder(orderRes.data)
      setCards(cardsRes.data)
    }).catch(err => {
      console.error(err)
    }).finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!order) return
    const pollStatuses = ['pending_payment', 'pending_confirmation']
    if (!pollStatuses.includes(order.status)) return
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/orders/${orderId}`)
        setOrder(res.data)
      } catch (e) {}
    }, 3000)
    return () => clearInterval(interval)
  }, [order?.status, orderId])

  useEffect(() => {
    if (!countdown.expired || !order || order.status !== 'pending_payment') return
    axios.post(`/api/orders/${orderId}/auto-cancel`).then(() => {
      setOrder(prev => prev ? { ...prev, status: 'rejected', admin_note: 'Avtomatik bekor qilindi: 4 daqiqada chek yuklanmadi' } : prev)
    }).catch(() => {})
  }, [countdown.expired, order?.status, orderId])

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('receipt', file)
      await axios.post(`/api/orders/${orderId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const res = await axios.get(`/api/orders/${orderId}`)
      setOrder(res.data)
    } catch (err) {
      console.error(err)
      alert('Chek yuklashda xatolik')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <Header title="Buyurtma" />
        <div className="p-4 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="animate-fade-in">
        <Header title="Buyurtma" />
        <div className="p-4 text-center py-16 text-tg-hint">
          <p className="text-4xl mb-2">🔍</p>
          <p>Buyurtma topilmadi</p>
        </div>
      </div>
    )
  }

  const status = statusMap[order.status] || { label: order.status, color: 'bg-tg-hint/10 text-tg-hint', icon: '❓', desc: '' }
  const canReview = ['sent', 'ready'].includes(order.status) && !reviewDone
  const servicePrice = (order.total_price || 0) - (order.language_surcharge || 0) - (order.geographic_surcharge || 0) + (order.promo_discount || 0) + (order.referral_discount || 0)

  return (
    <div className="animate-fade-in min-h-screen">
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-slide-up { animation: slideUp 0.3s ease-out }
      `}</style>

      <Header title="Buyurtma" subtitle={order.order_code} onBack={() => navigate('/my-orders')} />

      <div className="p-4 space-y-3 pb-8">
        <div className={`rounded-2xl p-4 ${status.color} flex items-center gap-3`}>
          <span className="text-3xl">{status.icon}</span>
          <div>
            <p className="font-semibold">{status.label}</p>
            <p className="text-sm opacity-80 mt-0.5">{status.desc}</p>
          </div>
        </div>

        <div className="bg-tg-secondary rounded-2xl p-4 shadow-card border border-tg-text/5">
          <h3 className="font-semibold text-tg-text mb-3">Buyurtma ma'lumotlari</h3>
          <div className="space-y-2.5 text-sm">
            <Row label="Xizmat" value={order.service_name} />
            <div className="pt-2 space-y-1">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-tg-hint shrink-0">Xizmat narxi:</span>
                <span className="text-tg-text">{servicePrice.toLocaleString()} so'm</span>
              </div>
              {order.language_surcharge > 0 && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-amber-600 shrink-0">Boshqa tilda yozish uchun:</span>
                  <span className="text-amber-600">+{order.language_surcharge.toLocaleString()} so'm</span>
                </div>
              )}
              {order.geographic_surcharge > 0 && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-amber-600 shrink-0">
                    {order.geographic_level === 'viloyat' ? 'Viloyat darajasi:' : 'Respublika darajasi:'}
                  </span>
                  <span className="text-amber-600">+{order.geographic_surcharge.toLocaleString()} so'm</span>
                </div>
              )}
              {order.promo_discount > 0 && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-green-600 shrink-0">Promo-kod chegirmasi:</span>
                  <span className="text-green-600">-{order.promo_discount.toLocaleString()} so'm</span>
                </div>
              )}
              {order.referral_discount > 0 && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-green-600 shrink-0">Taklif chegirmasi:</span>
                  <span className="text-green-600">-{order.referral_discount.toLocaleString()} so'm</span>
                </div>
              )}
              <div className="flex justify-between gap-3 items-center pt-1 border-t border-tg-text/10">
                <span className="font-bold text-tg-text">Jami to'lov:</span>
                <span className="font-bold text-primary-600 text-lg">{order.total_price?.toLocaleString()} so'm</span>
              </div>
            </div>
            <Row label="F.I.Sh" value={order.full_name} />
            <Row label="Maktab" value={order.school} />
            {order.school_type && (
              <Row label="Maktab turi" value={
                order.school_type === 'uzbek' ? "🇺🇿 O'zbek maktab" :
                order.school_type === 'russian' ? '🇷🇺 Rus maktab' :
                order.school_type === 'qoraqalpoq' ? "🏛 Qoraqalpoq maktab" : order.school_type
              } />
            )}
            {order.language_surcharge > 0 && (
              <Row label="Til qo'shimcha" value={`+${order.language_surcharge.toLocaleString()} so'm`} />
            )}
            <Row label="Fan" value={order.subject} />
            <Row label="Sinf" value={`${order.grade}-sinf`} />
            <Row label="Mavzu" value={order.topic} />
          </div>
        </div>

        {order.images && order.images.length > 0 && (
          <div className="bg-tg-secondary rounded-2xl p-4 shadow-card border border-tg-text/5">
            <h3 className="font-semibold text-tg-text mb-3">Rasmlar</h3>
            <div className="flex gap-2 flex-wrap">
              {order.images.map((img, idx) => (
                <img key={idx} src={img.image_path} alt="" className="w-20 h-20 object-cover rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {order.status === 'pending_payment' && (
          <div className="bg-tg-secondary rounded-2xl p-4 shadow-card border border-tg-text/5">
            <div className={`rounded-xl p-4 mb-4 text-center ${countdown.expired ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
              {countdown.expired ? (
                <>
                  <p className="font-bold text-lg">Vaqt tugadi!</p>
                  <p className="text-sm mt-0.5">Buyurtma avtomatik bekor qilindi</p>
                </>
              ) : (
                <>
                  <p className="font-medium">Chekni yuklash uchun qolgan vaqt:</p>
                  <p className="text-3xl font-bold font-mono mt-1">
                    {countdown.mins}:{countdown.secs.toString().padStart(2, '0')}
                  </p>
                </>
              )}
            </div>

            <h3 className="font-semibold text-tg-text mb-3">To'lov</h3>
            {cards.length > 0 && (
              <div className="bg-tg-text/5 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-tg-hint">Karta raqami</p>
                  <CopyButton text={cards[0].card_number.replace(/\s/g, '')} label="Raqamni nusxalash" />
                </div>
                <p className="font-mono font-bold text-lg text-tg-text mt-0.5">{cards[0].card_number.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()}</p>
                <p className="text-sm text-tg-text">{cards[0].card_holder}</p>
                {cards[0].bank_name && <p className="text-xs text-tg-hint">{cards[0].bank_name}</p>}
                <div className="mt-3 pt-3 border-t border-tg-text/10 flex items-center justify-between">
                  <span className="text-sm text-tg-hint">To'lov summasi:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary-600">{order.total_price?.toLocaleString()} so'm</span>
                    <CopyButton text={String(order.total_price)} label="Summani nusxalash" />
                  </div>
                </div>
              </div>
            )}
            {!countdown.expired ? (
              <label className="block w-full">
                <div className={`border-2 border-dashed border-primary-300 rounded-xl p-5 text-center cursor-pointer hover:border-primary-500 transition-colors ${uploading ? 'opacity-50' : ''}`}>
                  {uploading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent mx-auto"></div>
                  ) : (
                    <>
                      <span className="text-3xl">📸</span>
                      <p className="text-tg-hint mt-1 text-sm">Chek rasmini yuklash</p>
                    </>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" disabled={uploading} />
              </label>
            ) : (
              <div className="bg-rose-100 text-rose-700 rounded-xl p-4 text-center text-sm">
                Chek yuklash muddati tugagan
              </div>
            )}
          </div>
        )}

        {order.document_file && (
          <div className="bg-tg-secondary rounded-2xl p-4 shadow-card border border-tg-text/5">
            <h3 className="font-semibold text-tg-text mb-3">Hujjat</h3>
            <a href={order.document_file} target="_blank" rel="noopener noreferrer"
              className="block w-full bg-emerald-500 text-white rounded-xl py-3 text-center font-medium active:scale-95 transition-transform">
              Hujjatni yuklab olish ↓
            </a>
          </div>
        )}

        {order.admin_note && (
          <div className="bg-amber-100 rounded-2xl p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-1 flex items-center gap-2">⚠️ Eslatma</h3>
            <p className="text-sm text-amber-700">{order.admin_note}</p>
          </div>
        )}

        {/* ── REVIEW BLOCK ── */}
        {reviewDone ? (
          <div className="rounded-2xl p-4 text-center border border-emerald-200 bg-emerald-50">
            <p className="text-2xl mb-1">🎉</p>
            <p className="font-bold text-emerald-700">Sharhingiz uchun rahmat!</p>
            <p className="text-xs text-emerald-600 mt-0.5">Moderatsiyadan o'tgach nashr etiladi</p>
          </div>
        ) : canReview ? (
          <div className="rounded-2xl p-4 border border-indigo-100"
            style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="font-bold text-indigo-800 text-sm">Xizmatimizni baholang</p>
                <p className="text-xs text-indigo-500">Fikringiz boshqalarga yordam beradi</p>
              </div>
            </div>
            <button
              onClick={() => setShowReview(true)}
              className="w-full py-3 rounded-xl font-bold text-sm text-white active:scale-[.97] transition-transform"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              Sharh yozish →
            </button>
          </div>
        ) : null}
      </div>

      {showReview && (
        <ReviewModal
          order={order}
          user={user}
          onClose={() => setShowReview(false)}
          onSuccess={() => { setShowReview(false); setReviewDone(true) }}
        />
      )}
    </div>
  )
}

function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-tg-hint shrink-0">{label}:</span>
      <span className={`font-medium text-right ${accent ? 'text-primary-600' : 'text-tg-text'}`}>{value}</span>
    </div>
  )
}

export default OrderDetail
