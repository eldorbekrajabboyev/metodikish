import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/api'

function Login() {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!apiKey.trim()) return setError('API kalitni kiriting')
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/api/admin/login', { api_key: apiKey.trim() })
      sessionStorage.setItem('admin_token', res.data.token)
      navigate('/admin/')
      window.location.reload()
    } catch (err) {
      setError(err.response?.data?.error || 'Kirish xatosi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold dark:text-white">📚 Metodikish</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Admin Panel Kirish</p>
        </div>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API kalitni kiriting"
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 text-white rounded-lg py-3 font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Tekshirilmoqda...' : '🔐 Kirish'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
