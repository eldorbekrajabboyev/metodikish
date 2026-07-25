import { useState, useEffect } from 'react'
import api from '../api/api'

function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/users')
      .then(res => setUsers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Foydalanuvchilar ({users.length})</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">ID</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Telegram ID</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Username</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Ism</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Taklif qilgan</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Chegirma balansi</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Sana</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3 text-sm dark:text-gray-200">{user.id}</td>
                <td className="px-4 py-3 text-sm font-mono dark:text-gray-200">{user.telegram_id}</td>
                <td className="px-4 py-3 text-sm dark:text-gray-200">@{user.username || 'N/A'}</td>
                <td className="px-4 py-3">
                  <p className="font-medium dark:text-gray-200">{user.first_name} {user.last_name || ''}</p>
                </td>
                <td className="px-4 py-3 text-sm dark:text-gray-200">{user.referred_count || 0}</td>
                <td className="px-4 py-3 text-sm dark:text-gray-200">{(user.referral_balance || 0).toLocaleString()} so'm</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(user.created_at).toLocaleDateString('uz-UZ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Users
