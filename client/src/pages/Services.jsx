import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'

function Services({ user }) {
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [orderWarning, setOrderWarning] = useState(null)
  const [checkingOrders, setCheckingOrders] = useState(false)

  useEffect(() => {
    axios.get('/api/services')
      .then(res => setServices(res.data.filter(s => s.is_active)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleServiceClick = async (service) => {
    if (!user?.id) { navigate(`/order/${service.id}`); return }
    setCheckingOrders(true)
    try {
      const res = await axios.get(`/api/user/orders/${user.id}`)
      const orders = res.data || []
      const hasPendingPayment = orders.some(o => o.status === 'pending_payment')
      if (hasPendingPayment) {
        setOrderWarning("Sizda to'lov kutilmoqda buyurtma mavjud. Buyurtma bekor bo'lishini kuting yoki to'lov qiling.")
        return
      }
      const checkingCount = orders.filter(o => o.status === 'pending_confirmation').length
      if (checkingCount >= 4) {
        setOrderWarning(`Sizda ${checkingCount} ta tekshirilmoqda buyurtma mavjud. Yangi buyurtma berish uchun tekshirilayotgan buyurtmalaringiz tasdiqlanishini kuting.`)
        return
      }
      navigate(`/order/${service.id}`)
    } catch {
      navigate(`/order/${service.id}`)
    } finally {
      setCheckingOrders(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <Header title="Xizmatlar" />
        <div className="p-4 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in min-h-screen">
      <Header title="Xizmatlar" subtitle="Metodik hujjat turlari" />

      <div className="p-4 space-y-3">
        {services.map(service => (
          <button
            key={service.id}
            onClick={() => handleServiceClick(service)}
            className="w-full text-left bg-tg-secondary rounded-2xl p-4 shadow-card border border-tg-text/5 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg text-tg-text">{service.name}</h3>
                {service.description && (
                  <p className="text-tg-hint text-sm mt-1 leading-snug">{service.description}</p>
                )}
              </div>
              <div className="shrink-0 w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-xl">
                📄
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-tg-text/5">
              <div>
                {service.discounted_price && service.discounted_price < service.price ? (
                  <div className="flex items-baseline gap-2">
                    <p className="text-primary-600 font-bold text-xl">
                      {service.discounted_price.toLocaleString()} <span className="text-sm font-medium">so'm</span>
                    </p>
                    <p className="text-tg-hint line-through text-sm">
                      {service.price.toLocaleString()} so'm
                    </p>
                  </div>
                ) : (
                  <p className="text-primary-600 font-bold text-xl">
                    {service.price.toLocaleString()} <span className="text-sm font-medium">so'm</span>
                  </p>
                )}
              </div>
              <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
                Tanlash →
              </span>
            </div>
          </button>
        ))}

        {services.length === 0 && (
          <div className="text-center py-16 text-tg-hint">
            <p className="text-5xl mb-3">📭</p>
            <p>Hozircha xizmatlar mavjud emas</p>
          </div>
        )}
      </div>

      {orderWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tg-text/40 p-4" onClick={() => setOrderWarning(null)}>
          <div className="bg-tg-secondary rounded-2xl w-full max-w-sm p-6 shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-tg-text font-medium text-sm leading-relaxed mb-4">{orderWarning}</p>
            <button
              onClick={() => setOrderWarning(null)}
              className="w-full py-3 rounded-2xl font-medium bg-primary-600 text-white active:bg-primary-700 transition-colors"
            >
              Tayyor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Services
