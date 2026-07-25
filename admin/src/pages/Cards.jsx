import { useState, useEffect } from 'react'
import api from '../api/api'

function Cards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ card_number: '', card_holder: '', bank_name: '' })

  useEffect(() => {
    fetchCards()
  }, [])

  const fetchCards = () => {
    setLoading(true)
    api.get('/api/cards')
      .then(res => setCards(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/api/cards/${editing.id}`, { ...form, is_active: editing.is_active })
      } else {
        await api.post('/api/cards', form)
      }
      setShowForm(false)
      setEditing(null)
      setForm({ card_number: '', card_holder: '', bank_name: '' })
      fetchCards()
    } catch (err) {
      alert('Xatolik')
    }
  }

  const handleEdit = (card) => {
    setEditing(card)
    setForm({ card_number: card.card_number, card_holder: card.card_holder, bank_name: card.bank_name || '' })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm("O'chirishni xohlaysizmi?")) return
    try {
      await api.delete(`/api/cards/${id}`)
      fetchCards()
    } catch (err) {
      alert('Xatolik')
    }
  }

  const toggleActive = async (card) => {
    try {
      await api.put(`/api/cards/${card.id}`, {
        ...card,
        is_active: card.is_active ? 0 : 1,
      })
      fetchCards()
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">To'lov kartalari</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ card_number: '', card_holder: '', bank_name: '' }) }}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
        >
          + Yangi karta
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 dark:text-white">{editing ? 'Tahrirlash' : 'Yangi karta'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Karta raqami</label>
                <input
                  type="text"
                  value={form.card_number}
                  onChange={(e) => setForm({ ...form, card_number: e.target.value })}
                  placeholder="8600 1234 5678 9012"
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Karta egasi</label>
                <input
                  type="text"
                  value={form.card_holder}
                  onChange={(e) => setForm({ ...form, card_holder: e.target.value })}
                  placeholder="IVANOV IVAN"
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Bank nomi</label>
                <input
                  type="text"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  placeholder="Humo, UzCard, Visa..."
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-500 text-white rounded-lg py-2 hover:bg-primary-600 transition-colors"
                >
                  {editing ? 'Saqlash' : "Qo'shish"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 rounded-lg py-2 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="grid grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-mono text-lg font-bold dark:text-white">{card.card_number.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()}</p>
                <p className="text-gray-600 dark:text-gray-300 mt-1">{card.card_holder}</p>
                {card.bank_name && <p className="text-sm text-gray-500 dark:text-gray-400">{card.bank_name}</p>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                card.is_active ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300'
              }`}>
                {card.is_active ? 'Faol' : 'Nofaol'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleActive(card)}
                className="flex-1 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 rounded-lg py-2 text-sm hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
              >
                {card.is_active ? "O'chirish" : 'Yoqish'}
              </button>
              <button
                onClick={() => handleEdit(card)}
                className="flex-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg py-2 text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Tahrirlash
              </button>
              <button
                onClick={() => handleDelete(card.id)}
                className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg py-2 px-3 text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Cards
