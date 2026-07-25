import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Users from './pages/Users'
import Services from './pages/Services'
import Cards from './pages/Cards'
import Settings from './pages/Settings'
import Broadcast from './pages/Broadcast'
import Reviews from './pages/Reviews'
import PromoCodes from './pages/PromoCodes'
import Login from './pages/Login'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/orders', label: 'Buyurtmalar', icon: '📦' },
  { path: '/reviews', label: 'Sharhlar', icon: '⭐' },
  { path: '/users', label: 'Foydalanuvchilar', icon: '👥' },
  { path: '/services', label: 'Xizmatlar', icon: '📚' },
  { path: '/cards', label: 'Kartalar', icon: '💳' },
  { path: '/broadcast', label: 'Xabar yuborish', icon: '📨' },
  { path: '/promo-codes', label: 'Promo-kodlar', icon: '🏷️' },
  { path: '/settings', label: 'Sozlamalar', icon: '⚙️' },
]

function AuthGuard({ children }) {
  const token = sessionStorage.getItem('admin_token')
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

function Sidebar({ dark, setDark, open, setOpen }) {
  const location = useLocation()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📚 Metodikish</h1>
            <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <nav className="p-2 flex-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-700 space-y-2">
          <button
            onClick={() => setDark(d => { const next = !d; localStorage.setItem('admin-theme', next ? 'dark' : 'light'); return next })}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
          >
            {dark ? '☀️ Yorug\' rejim' : '🌙 Qorong\'u rejim'}
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('admin_token'); window.location.href = '/admin/login' }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-900/50 hover:bg-red-800/50 transition-colors text-sm text-red-300"
          >
            🚪 Chiqish
          </button>
        </div>
      </div>
    </>
  )
}

function App() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('admin-theme') === 'dark' || (!localStorage.getItem('admin-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <Router basename="/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={
          <AuthGuard>
            <div className={`min-h-screen ${dark ? 'dark' : ''}`}>
              <div className="dark:bg-gray-950 dark:text-gray-200 bg-gray-50 min-h-screen">
                <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-900 text-white px-4 py-3 flex items-center gap-3 shadow">
                  <button onClick={() => setSidebarOpen(true)} className="text-2xl">&#9776;</button>
                  <span className="font-bold">📚 Metodikish</span>
                </div>
                <Sidebar dark={dark} setDark={setDark} open={sidebarOpen} setOpen={setSidebarOpen} />
                <div className="md:ml-64 pt-14 md:pt-0">
                  <div className="p-4 md:p-6">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/orders/:id" element={<OrderDetail />} />
                      <Route path="/reviews" element={<Reviews />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/cards" element={<Cards />} />
                      <Route path="/broadcast" element={<Broadcast />} />
                      <Route path="/promo-codes" element={<PromoCodes />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </div>
                </div>
              </div>
            </div>
          </AuthGuard>
        } />
      </Routes>
    </Router>
  )
}

export default App
