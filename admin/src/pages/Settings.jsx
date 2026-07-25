import { useState, useEffect } from 'react'
import api from '../api/api'

function Settings() {
  const [settings, setSettings] = useState({})
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newChannel, setNewChannel] = useState({ name: '', link: '' })
  const [addingChannel, setAddingChannel] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/api/settings'),
      api.get('/api/settings/channels'),
    ]).then(([settingsRes, channelsRes]) => {
      setSettings(settingsRes.data)
      setChannels(channelsRes.data)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/api/settings', settings)
      alert('Saqlandi!')
    } catch (err) {
      alert('Xatolik')
    } finally {
      setSaving(false)
    }
  }

  const handleAddChannel = async () => {
    if (!newChannel.name || !newChannel.link) {
      alert('Nomi va link kiritilishi shart')
      return
    }
    setAddingChannel(true)
    try {
      await api.post('/api/settings/channels', newChannel)
      const res = await api.get('/api/settings/channels')
      setChannels(res.data)
      setNewChannel({ name: '', link: '' })
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik')
    } finally {
      setAddingChannel(false)
    }
  }

  const handleDeleteChannel = async (index) => {
    if (!confirm('Kanalni o\'chirishni xohlaysizmi?')) return
    try {
      await api.delete(`/api/settings/channels/${index}`)
      const res = await api.get('/api/settings/channels')
      setChannels(res.data)
    } catch (err) {
      alert('Xatolik')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Sozlamalar</h1>

      <div className="max-w-2xl space-y-6">
        {/* Bot Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 dark:bg-gray-800 dark:border-gray-700/50">
          <h2 className="text-lg font-semibold dark:text-white">🤖 Bot sozlamalari</h2>

          {/* Bot Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              🤖 Bot Username (chegirma havolasi uchun)
            </label>
            <input
              type="text"
              value={settings.bot_username || ''}
              onChange={(e) => handleChange('bot_username', e.target.value)}
              placeholder="Masalan: metodikish_bot"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Bot username'siz chegirma havolasi ishlamaydi</p>
          </div>

          {/* Admin Chat ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              👑 Admin Telegram ID
            </label>
            <input
              type="text"
              value={settings.admin_chat_id || ''}
              onChange={(e) => handleChange('admin_chat_id', e.target.value)}
              placeholder="123456789"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
          </div>

          {/* Min Prep Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              ⏰ Minimal tayyorlash vaqti (soat)
            </label>
            <input
              type="number"
              value={settings.min_prep_time_hours || '6'}
              onChange={(e) => handleChange('min_prep_time_hours', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
          </div>

          {/* Payment Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              💳 To'lov ko'rsatmalari
            </label>
            <textarea
              value={settings.payment_instructions || ''}
              onChange={(e) => handleChange('payment_instructions', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              rows={4}
              placeholder="To'lov haqida ko'rsatmalar..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary-500 text-white rounded-lg py-3 font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : '💾 Saqlash'}
          </button>
        </div>

        {/* Chegirma tizimi sozlamalari */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 dark:bg-gray-800 dark:border-gray-700/50">
          <h2 className="text-lg font-semibold dark:text-white">👥 Chegirma tizimi sozlamalari</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              💰 Taklif qilgan ustoz uchun chegirma (so'm)
            </label>
            <input
              type="number"
              value={settings.referral_discount_amount || '0'}
              onChange={(e) => handleChange('referral_discount_amount', e.target.value)}
              placeholder="Masalan: 20000"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              1 ta do'stni taklif qilganingizda sizga beriladigan chegirma miqdori. 0 = o'chirilgan.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              🎁 Taklif qilingan ustozga beriladigan chegirma (so'm)
            </label>
            <input
              type="number"
              value={settings.referral_reward_amount || '0'}
              onChange={(e) => handleChange('referral_reward_amount', e.target.value)}
              placeholder="Masalan: 10000"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Taklif qilingan ustoz birinchi buyurtma qilganda unga beriladigan chegirma miqdori. 0 = o'chirilgan.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary-500 text-white rounded-lg py-3 font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : '💾 Saqlash'}
          </button>
        </div>

        {/* Channels Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700/50">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">📢 Majburiy obuna kanallari</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Botni ishlatishdan oldin foydalanuvchi ushbu kanallarga obuna bo'lishi kerak. (Maksimal 5 ta)
          </p>

          {/* Channel List */}
          {channels.length > 0 && (
            <div className="space-y-2 mb-4">
              {channels.map((ch, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 dark:bg-gray-900">
                  <div>
                    <p className="font-medium dark:text-white">{ch.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ch.link}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteChannel(idx)}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-3 py-1 rounded"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          {channels.length === 0 && (
            <p className="text-gray-400 text-sm mb-4 dark:text-gray-500">Hali kanal qo'shilmagan</p>
          )}

          {/* Add Channel Form */}
          <div className="border-t pt-4 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newChannel.name}
                onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                placeholder="Kanal nomi"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              />
              <input
                type="text"
                value={newChannel.link}
                onChange={(e) => setNewChannel({ ...newChannel, link: e.target.value })}
                placeholder="https://t.me/..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              />
              <button
                onClick={handleAddChannel}
                disabled={addingChannel || channels.length >= 5}
                className="bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
              >
                {addingChannel ? '...' : '+ Qo\'shish'}
              </button>
            </div>
            {channels.length >= 5 && (
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-2">Maksimal 5 ta kanal qo'shilgan</p>
            )}
          </div>
        </div>

        {/* Help */}
        <div className="bg-yellow-50 rounded-xl p-4 dark:bg-yellow-900/30">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">ℹ️ Yordam</h3>
          <div className="text-sm text-yellow-700 dark:text-yellow-200 space-y-2">
            <p><strong>Majburiy obuna kanallari:</strong> Foydalanuvchi /start bosganida avval kanallarga obuna bo'lishi kerak. Kanal linkini @dan oling.</p>
            <p><strong>Bot Token:</strong> @BotFather dan /newproduct buyrug'i orqali olingan token.</p>
            <p><strong>Admin Chat ID:</strong> Botga /start yuborganingizdan so'ng, @userinfobot dan ID ni olishingiz mumkin.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
