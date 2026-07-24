import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Home from './pages/Home'
import Services from './pages/Services'
import OrderForm from './pages/OrderForm'
import MyOrders from './pages/MyOrders'
import OrderDetail from './pages/OrderDetail'
import Profile from './pages/Profile'
import BottomNav from './components/BottomNav'
import { applyTelegramTheme } from './theme'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const tg = window.Telegram?.WebApp
  if (tg?.initData) {
    config.headers['X-Telegram-Init-Data'] = tg.initData
  }
  return config
})

// Global axios ga ham header qo'shish (sahifalarda to'g'ridan-to'g'ri ishlatiladi)
axios.interceptors.request.use((config) => {
  const tg = window.Telegram?.WebApp
  if (tg?.initData) {
    config.headers['X-Telegram-Init-Data'] = tg.initData
  }
  return config
})

const MAIN_ROUTES = ['/', '/services', '/my-orders', '/profile']

function AppContent() {
  const [user, setUser] = useState(null)
  const location = useLocation()
  const showNav = MAIN_ROUTES.includes(location.pathname)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      applyTelegramTheme()
      tg.onEvent?.('themeChanged', applyTelegramTheme)
    }

    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user
      setUser(u)
      api.post('/users', {
        telegram_id: u.id,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
      }).catch(console.error)
    }
  }, [])

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text">
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/services" element={<Services user={user} />} />
        <Route path="/order/:serviceId" element={<OrderForm user={user} />} />
        <Route path="/my-orders" element={<MyOrders user={user} />} />
        <Route path="/order-detail/:orderId" element={<OrderDetail user={user} />} />
        <Route path="/profile" element={<Profile user={user} />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}

function TelegramGate({ children }) {
  const isTelegram = !!window.Telegram?.WebApp?.initData
  if (!isTelegram) {
    return (
      <div className="min-h-screen bg-tg-bg flex items-center justify-center p-6">
        <div className="bg-tg-secondary rounded-2xl p-8 max-w-sm w-full text-center border border-tg-text/5">
          <p className="text-5xl mb-4">🔒</p>
          <h1 className="text-xl font-bold mb-2">Telegram MiniApp</h1>
          <p className="text-tg-hint text-sm">Bu ilova faqat Telegram orqali ochiladi. Iltimos, Telegram bot orqali kirib, xizmatni tanlang.</p>
        </div>
      </div>
    )
  }
  return children
}

function App() {
  return (
    <Router>
      <TelegramGate>
        <AppContent />
      </TelegramGate>
    </Router>
  )
}

export default App
