import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'

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

function Profile({ user }) {
  const navigate = useNavigate()
  const [referralInfo, setReferralInfo] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      axios.get(`/api/user/referral-info/${user.id}`),
      axios.get('/api/settings'),
    ]).then(([refRes, setRes]) => {
      setReferralInfo(refRes.data)
      const botUsername = setRes.data.bot_username || ''
      setReferralInfo({ ...refRes.data, bot_username: botUsername })
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [user])

  const referralLink = referralInfo?.bot_username
    ? `https://t.me/${referralInfo.bot_username}?start=ref_${user?.id}`
    : ''

  const handleCopy = () => {
    if (!referralLink) return
    copyToClipboard(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <Header title="Profil" />
        <div className="p-4 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in min-h-screen">
      <Header title="Profil" onBack={() => navigate('/')} />

      <div className="p-4 space-y-4 pb-8">
        {/* User info */}
        <div className="bg-tg-secondary rounded-2xl p-5 border border-tg-text/5 text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-2xl font-bold mx-auto">
            {user?.first_name?.[0] || '?'}
          </div>
          <h2 className="text-lg font-semibold">{user?.first_name} {user?.last_name || ''}</h2>
          {user?.username && <p className="text-sm text-tg-hint">@{user.username}</p>}
        </div>

        {/* Chegirma havolasi */}
        {referralLink && (
          <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5 space-y-3">
            <h3 className="font-semibold text-sm">👥 Do'stni taklif qilish</h3>
            <p className="text-xs text-tg-hint">
              1 ta do'stingizni taklif qilsangiz — sizga 20 000 so'm, do'stingizga 10 000 so'm chegirma beriladi
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-xl border border-tg-hint/20 text-xs bg-tg-secondary text-tg-hint font-mono"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                {copied ? '✓' : 'Nusxa'}
              </button>
            </div>
          </div>
        )}

        {/* Chegirma statistikasi */}
        <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5 space-y-3">
          <h3 className="font-semibold text-sm">📊 Chegirma statistikasi</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-tg-secondary rounded-xl p-3 text-center border border-tg-text/5">
              <p className="text-2xl font-bold text-primary-600">{referralInfo?.referred_count || 0}</p>
              <p className="text-xs text-tg-hint mt-1">Taklif qilingan</p>
            </div>
            <div className="bg-tg-secondary rounded-xl p-3 text-center border border-tg-text/5">
              <p className="text-2xl font-bold text-green-600">{(referralInfo?.referral_balance || 0).toLocaleString()}</p>
              <p className="text-xs text-tg-hint mt-1">Chegirma balansi (so'm)</p>
            </div>
          </div>
          {referralInfo?.referral_discount_amount > 0 && (
            <p className="text-xs text-tg-hint text-center">
              1 ta do'stni taklif qilganingiz uchun +{referralInfo.referral_discount_amount.toLocaleString()} so'm chegirma
            </p>
          )}
        </div>

        {/* Qanday ishlaydi? */}
        <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5 space-y-2">
          <h3 className="font-semibold text-sm">💡 Qanday ishlaydi?</h3>
          <ol className="text-xs text-tg-hint space-y-1.5 list-decimal list-inside">
            <li>Do'stingizga havolani yuboring</li>
            <li>U havola orqali botga kiradi</li>
            <li>Buyurtma berib, to'lov qiladi</li>
            <li>To'lov tasdiqlanganda sizga chegirma qo'shiladi</li>
            <li>Keyingi buyurtmangizda chegirmadan foydalaning</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Profile
