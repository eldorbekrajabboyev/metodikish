import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const SCHOOL_TYPES = [
  { id: 'uzbek', label: "O'zbek maktab", icon: '\u{1F1FA}\u{1F1FF}' },
  { id: 'russian', label: 'Rus maktab', icon: '\u{1F1F7}\u{1F1FA}' },
  { id: 'qoraqalpoq', label: "Qoraqalpoq maktab", icon: '\u{1F3DB}' },
]

function getLanguageSurcharge(schoolType, subject) {
  if (!schoolType || !subject) return 0
  const st = schoolType
  const sub = subject.toLowerCase()
  const isUzbek = sub === "o'zbek tili" || sub === 'ona tili' || sub === "o'qish" ||
    sub === 'ўзбек тили' || sub === 'ана тили' || sub === 'ўқиш' ||
    sub === 'карақалпақ тили'
  const isRussian = sub === 'rus tili' || sub === 'русский язык'
  const isEnglish = sub === 'ingliz tili' || sub === 'английский язык'
  if (st === 'uzbek') {
    if (isRussian || isEnglish) return 50000
    return 0
  }
  if (st === 'russian') {
    if (isUzbek) return 0
    if (isEnglish) return 60000
    return 50000
  }
  if (st === 'qoraqalpoq') {
    if (isUzbek || sub === 'карақалпақ тили') return 0
    if (isRussian || isEnglish) return 60000
    return 50000
  }
  return 0
}

function getSubjects(grade, schoolType) {
  const g = parseInt(grade)
  const st = schoolType || 'uzbek'

  if (st === 'uzbek') {
    if (g === 1) {
      return ['Alifbe', "O'qish", 'Ona tili', 'Matematika', 'Tarbiya', 'Tabiiy fan', 'Texnologiya', "Tasviriy san'at", 'Musiqa madaniyati', 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g >= 2 && g <= 4) {
      return ['Ona tili', "O'qish", 'Matematika', 'Tarbiya', 'Tabiiy fan', 'Texnologiya', "Tasviriy san'at", 'Musiqa madaniyati', 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g === 5) {
      return ['Ona tili', 'Adabiyot', "O'zbek tili", 'Matematika', 'Tabiiy fan', 'Tarix', 'Tarbiya', 'Informatika va axborot texnologiyalari', 'Texnologiya', "Tasviriy san'at", 'Musiqa madaniyati', 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g === 6) {
      return ['Ona tili', 'Adabiyot', 'Matematika', 'Tabiiy fan', 'Tarix', 'Tarbiya', 'Informatika va axborot texnologiyalari', 'Texnologiya', "Tasviriy san'at", 'Musiqa madaniyati', 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g === 7) {
      return ['Ona tili', 'Adabiyot', 'Algebra', 'Geometriya', 'Fizika', 'Kimyo', 'Biologiya', "O'zbekiston tarixi", 'Jahon tarixi', 'Geografiya', 'Tarbiya', 'Informatika va axborot texnologiyalari', 'Texnologiya', "Tasviriy san'at", 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g === 8) {
      return ['Ona tili', 'Adabiyot', 'Algebra', 'Geometriya', 'Fizika', 'Kimyo', 'Biologiya', "O'zbekiston tarixi", 'Jahon tarixi', 'Geografiya', "Davlat va huquq asoslari", 'Tarbiya', 'Informatika va axborot texnologiyalari', 'Texnologiya', 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g === 9) {
      return ['Ona tili', 'Adabiyot', 'Algebra', 'Geometriya', 'Fizika', 'Kimyo', 'Biologiya', "O'zbekiston tarixi", 'Jahon tarixi', 'Geografiya', "Davlat va huquq asoslari", 'Tarbiya', 'Informatika va axborot texnologiyalari', 'Iqtisodiy bilim asoslari', 'Jismoniy tarbiya', 'Ingliz tili']
    } else if (g >= 10 && g <= 11) {
      return ['Ona tili', 'Adabiyot', 'Algebra va analiz asoslari', 'Geometriya', 'Fizika', 'Kimyo', 'Biologiya', "O'zbekiston tarixi", 'Jahon tarixi', 'Geografiya', 'Huquq', 'Tarbiya', 'Informatika', "Chaqiruvga qadar boshlang'ich tayyorgarlik", 'Jismoniy tarbiya', 'Ingliz tili']
    }
  }

  if (st === 'russian') {
    if (g >= 1 && g <= 4) {
      return ['Русский язык', 'Литературное чтение', 'Математика', 'Воспитание', 'Естествознание', 'Технология', 'Изобразительное искусство', 'Музыка', 'Физическая культура', 'Английский язык', 'Узбекский язык']
    } else if (g >= 5 && g <= 6) {
      return ['Русский язык', 'Русская литература', 'Математика', 'Естествознание', 'История', 'Воспитание', 'Информатика', 'Технология', 'Изобразительное искусство', 'Музыка', 'Физическая культура', 'Английский язык', 'Узбекский язык']
    } else if (g === 7) {
      return ['Русский язык', 'Русская литература', 'Алгебра', 'Геометрия', 'Физика', 'Химия', 'Биология', 'История Узбекистана', 'Всемирная история', 'География', 'Воспитание', 'Информатика', 'Технология', 'Изобразительное искусство', 'Физическая культура', 'Английский язык', 'Узбекский язык']
    } else if (g === 8) {
      return ['Русский язык', 'Русская литература', 'Алгебра', 'Геометрия', 'Физика', 'Химия', 'Биология', 'История Узбекистана', 'Всемирная история', 'География', 'Основы государства и права', 'Воспитание', 'Информатика', 'Технология', 'Физическая культура', 'Английский язык', 'Узбекский язык']
    } else if (g === 9) {
      return ['Русский язык', 'Русская литература', 'Алгебра', 'Геометрия', 'Физика', 'Химия', 'Биология', 'История Узбекистана', 'Всемирная история', 'География', 'Основы государства и права', 'Воспитание', 'Информатика', 'Основы экономики', 'Физическая культура', 'Английский язык', 'Узбекский язык']
    } else if (g >= 10 && g <= 11) {
      return ['Русский язык', 'Русская литература', 'Алгебра и начала анализа', 'Геометрия', 'Физика', 'Химия', 'Биология', 'История Узбекистана', 'Всемирная история', 'География', 'Право', 'Воспитание', 'Информатика', 'Начальная допризывная подготовка', 'Физическая культура', 'Английский язык', 'Узбекский язык']
    }
  }

  if (st === 'qoraqalpoq') {
    if (g >= 1 && g <= 4) {
      return ['Qaraqalpaq tili', 'Oqıw', 'Matematika', 'Tárbiya', 'Tábiyiy pán', 'Texnologiya', 'Súwret salıw', 'Muzıka', 'Dene tárbiyası', 'Inglis tili', 'Ózbek tili']
    } else if (g >= 5 && g <= 6) {
      return ['Qaraqalpaq tili', 'Qaraqalpaq ádebiyatı', 'Matematika', 'Tábiyiy pán', 'Tariyx', 'Tárbiya', 'Informatika', 'Texnologiya', 'Súwret salıw', 'Muzıka', 'Dene tárbiyası', 'Inglis tili', 'Ózbek tili']
    } else if (g === 7) {
      return ['Qaraqalpaq tili', 'Qaraqalpaq ádebiyatı', 'Algebra', 'Geometriya', 'Fizika', 'Ximiya', 'Biologiya', 'Ózbekstan tariyxı', 'Dúnya tariyxı', 'Geografiya', 'Tárbiya', 'Informatika', 'Texnologiya', 'Súwret salıw', 'Dene tárbiyası', 'Inglis tili', 'Ózbek tili']
    } else if (g === 8) {
      return ['Qaraqalpaq tili', 'Qaraqalpaq ádebiyatı', 'Algebra', 'Geometriya', 'Fizika', 'Ximiya', 'Biologiya', 'Ózbekstan tariyxı', 'Dúnya tariyxı', 'Geografiya', 'Mámleket hám huqıq tiykarları', 'Tárbiya', 'Informatika', 'Texnologiya', 'Dene tárbiyası', 'Inglis tili', 'Ózbek tili']
    } else if (g === 9) {
      return ['Qaraqalpaq tili', 'Qaraqalpaq ádebiyatı', 'Algebra', 'Geometriya', 'Fizika', 'Ximiya', 'Biologiya', 'Ózbekstan tariyxı', 'Dúnya tariyxı', 'Geografiya', 'Mámleket hám huqıq tiykarları', 'Tárbiya', 'Informatika', 'Ekonomika tiykarları', 'Dene tárbiyası', 'Inglis tili', 'Ózbek tili']
    } else if (g >= 10 && g <= 11) {
      return ['Qaraqalpaq tili', 'Qaraqalpaq ádebiyatı', 'Algebra hám analiz tiykarları', 'Geometriya', 'Fizika', 'Ximiya', 'Biologiya', 'Ózbekstan tariyxı', 'Dúnya tariyxı', 'Geografiya', 'Huqıq', 'Tárbiya', 'Informatika', 'Áskerlikke shekemgi tayarlıq', 'Dene tárbiyası', 'Inglis tili', 'Ózbek tili']
    }
  }

  return []
}

function ImageThumb({ file }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
}

function OrderForm({ user }) {
  const navigate = useNavigate()
  const { serviceId } = useParams()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [images, setImages] = useState([])
  const [cards, setCards] = useState([])
  const [regionsData, setRegionsData] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [promoCodeId, setPromoCodeId] = useState(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [hasPromo, setHasPromo] = useState(false)
  const [referralBalance, setReferralBalance] = useState(0)
  const [referralDiscountAmount, setReferralDiscountAmount] = useState(0)
  const [useReferral, setUseReferral] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    region: '',
    district: '',
    school: '',
    school_type: '',
    grade: '',
    subject: '',
    topic: '',
    geo_extra: false,
    geographic_level: 'maktab',
  })

  const isKarakalpakstan = form.region === "Qoraqalpog'iston Respublikasi"
  const availableSchoolTypes = isKarakalpakstan ? SCHOOL_TYPES : SCHOOL_TYPES.filter(st => st.id !== 'qoraqalpoq')

  useEffect(() => {
    if (form.region && form.district && !districts.includes(form.district)) {
      setForm(f => ({ ...f, district: '' }))
    }
  }, [form.region, districts])

  useEffect(() => {
    if (!isKarakalpakstan && form.school_type === 'qoraqalpoq') {
      setForm(f => ({ ...f, school_type: '' }))
    }
  }, [isKarakalpakstan])

  useEffect(() => {
    Promise.all([
      axios.get('/api/services'),
      axios.get('/api/user/active-cards'),
      axios.get('/api/regions'),
    ]).then(([servicesRes, cardsRes, regionsRes]) => {
      const svc = servicesRes.data.find(s => s.id == serviceId)
      setService(svc)
      setCards(cardsRes.data)
      setRegionsData(regionsRes.data)
      if (user?.id) {
        axios.get(`/api/user/referral-info/${user.id}`).then(refRes => {
          setReferralBalance(refRes.data.referral_balance || 0)
          setReferralDiscountAmount(refRes.data.referral_discount_amount || 0)
        }).catch(() => {})
      }
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [serviceId, user])

  const regionNames = useMemo(() => regionsData ? regionsData.regions.map(r => r.name_uz) : [], [regionsData])

  const districts = useMemo(() => {
    if (!regionsData || !form.region) return []
    const region = regionsData.regions.find(r => r.name_uz === form.region)
    return region ? region.districts.map(d => d.name) : []
  }, [regionsData, form.region])

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    if (images.length + files.length > 5) {
      alert('Maksimal 5 ta rasm yuklash mumkin')
      return
    }
    setImages([...images, ...files].slice(0, 5))
  }

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const validatePromo = async () => {
    if (!promoCode.trim()) return
    setPromoChecking(true)
    setPromoError('')
    try {
      const res = await axios.post('/api/promo-codes/validate', {
        code: promoCode.trim(),
      })
      if (res.data.success) {
        const disc = Math.round(basePrice * res.data.discount_percent / 100)
        setPromoDiscount(disc)
        setPromoCodeId(res.data.promo_code_id || null)
      }
    } catch (err) {
      setPromoError(err.response?.data?.error || 'Promo-kod tekshirishda xatolik')
      setPromoDiscount(0)
      setPromoCodeId(null)
    }
    setPromoChecking(false)
  }

  const handleSubmit = async () => {
    if (!user) {
      alert('Foydalanuvchi aniqlanmadi')
      return
    }

    setSubmitting(true)
    try {
      const userRes = await axios.post('/api/users', {
        telegram_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      })

      const fullAddress = `${form.region}, ${form.district}`

      const orderRes = await axios.post('/api/orders', {
        service_id: serviceId,
        full_name: form.full_name,
        address: fullAddress,
        school: form.school,
        school_type: form.school_type,
        subject: form.subject,
        grade: form.grade,
        topic: form.topic,
        language_surcharge: getLanguageSurcharge(form.school_type, form.subject),
        geographic_level: form.geo_extra ? form.geographic_level : 'maktab',
        geographic_surcharge: geoSurcharge,
        promo_code_id: promoCodeId,
        promo_discount: promoDiscount,
        use_referral_discount: useReferral,
      })

      if (images.length > 0) {
        const formData = new FormData()
        images.forEach(img => formData.append('images', img))
        await axios.post(`/api/orders/${orderRes.data.id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      navigate(`/order-detail/${orderRes.data.id}`)
    } catch (err) {
      console.error(err)
      alert("Xatolik yuz berdi. Qaytadan urinib ko'ring.")
    } finally {
      setSubmitting(false)
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

  if (!service) {
    return (
      <div className="animate-fade-in">
        <Header title="Buyurtma" />
        <div className="p-4 text-center py-16 text-tg-hint">
          <p className="text-4xl mb-2">🔍</p>
          <p>Xizmat topilmadi</p>
        </div>
      </div>
    )
  }

  const langSurcharge = getLanguageSurcharge(form.school_type, form.subject)
  const geoSurcharge = form.geo_extra ? (form.geographic_level === 'viloyat' ? 60000 : form.geographic_level === 'respublika' ? 110000 : 0) : 0
  const basePrice = (service ? service.price : 0) + langSurcharge + geoSurcharge
  const activeReferralDiscount = useReferral && referralBalance >= referralDiscountAmount ? referralDiscountAmount : 0
  const totalPrice = basePrice - promoDiscount - activeReferralDiscount

  const steps = [
    { num: 1, title: 'F.I.Sh' },
    { num: 2, title: 'Manzil' },
    { num: 3, title: 'Maktab' },
    { num: 4, title: 'Fan' },
    { num: 5, title: 'Mavzu' },
  ]

  const canNext = () => {
    switch (step) {
      case 1: return form.full_name.trim()
      case 2: return form.region && form.district && form.school.trim()
      case 3: return form.school_type && form.grade
      case 4: return form.subject
      case 5: return form.topic.trim()
      default: return false
    }
  }

  const goNext = () => { if (canNext()) setStep(step + 1) }

  return (
    <div className="animate-fade-in min-h-screen">
      <Header
        title={service.name}
        subtitle={`${totalPrice.toLocaleString()} so'm${langSurcharge > 0 ? ' (til)' : ''}${geoSurcharge > 0 ? ' (daraja)' : ''}${promoDiscount > 0 ? ' (-promo)' : ''}${activeReferralDiscount > 0 ? ' (-referral)' : ''}`}
        onBack={() => step > 1 ? setStep(step - 1) : navigate(-1)}
      />

      <div className="p-4 space-y-3">
        <div className="flex gap-1.5 mb-2">
          {steps.map(s => (
            <div key={s.num} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${step >= s.num ? 'bg-primary-500' : 'bg-tg-text/5'}`}></div>
            </div>
          ))}
        </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">To'liq F.I.Sh</h2>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            maxLength={65}
            placeholder="Masalan: Karimov Valijon"
            className="w-full border border-tg-text/10 rounded-2xl px-4 py-3.5 text-lg bg-tg-secondary focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            autoFocus
          />
          <button onClick={goNext} disabled={!canNext()}
            className="w-full bg-primary-600 text-white rounded-2xl py-3.5 font-medium disabled:bg-tg-text/10 disabled:text-tg-hint active:bg-primary-700 transition-colors">
            Keyingisi →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">📍 Manzil</h2>

          <div>
            <label className="block text-sm font-medium text-tg-text mb-1">Viloyat</label>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value, district: '' })}
              className="w-full border border-tg-text/10 rounded-2xl px-4 py-3.5 text-base bg-tg-secondary focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Viloyatni tanlang</option>
              {regionNames.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tg-text mb-1">Tuman / Shahar</label>
            <select
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              disabled={!form.region}
              className="w-full border border-tg-text/10 rounded-2xl px-4 py-3.5 text-base bg-tg-secondary focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50"
            >
              <option value="">{form.region ? 'Tumanni tanlang' : 'Avval viloyatni tanlang'}</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tg-text mb-1">Maktab nomi</label>
            <input
              type="text"
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              maxLength={100}
              placeholder="Masalan: 1-maktab"
              className="w-full border border-tg-text/10 rounded-2xl px-4 py-3.5 text-lg bg-tg-secondary focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <button onClick={goNext} disabled={!canNext()}
            className="w-full bg-primary-600 text-white rounded-2xl py-3.5 font-medium disabled:bg-tg-text/10 disabled:text-tg-hint active:bg-primary-700 transition-colors">
            Keyingisi →
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold mb-3">🏫 Maktab turi</h2>
            <div className="space-y-2">
              {availableSchoolTypes.map(st => (
                <button
                  key={st.id}
                  onClick={() => setForm({ ...form, school_type: st.id })}
                  className={`w-full p-4 rounded-2xl text-left font-medium border-2 transition-all flex items-center gap-3 ${form.school_type === st.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-tg-hint/20 bg-tg-secondary text-tg-text active:bg-tg-text/5'}`}
                >
                  <span className="text-2xl">{st.icon}</span>
                  <span className="text-base">{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">🎓 Sinf</h2>
            <input
              type="number"
              min="1"
              max="11"
              value={form.grade}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 11)) {
                  setForm({ ...form, grade: val, subject: '' })
                }
              }}
              placeholder="Sinfni kiriting (1-11)"
              className="w-full border border-tg-text/10 rounded-2xl px-4 py-3.5 text-lg bg-tg-secondary focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <button onClick={goNext} disabled={!canNext()}
            className="w-full bg-primary-600 text-white rounded-2xl py-3.5 font-medium disabled:bg-tg-text/10 disabled:text-tg-hint active:bg-primary-700 transition-colors">
            Keyingisi →
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">📚 Fan nomini tanlang</h2>
          <p className="text-tg-hint text-sm">{form.grade}-sinf · {SCHOOL_TYPES.find(s => s.id === form.school_type)?.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {getSubjects(form.grade, form.school_type).map(subject => (
              <button
                key={subject}
                onClick={() => setForm({ ...form, subject })}
                className={`p-3 rounded-lg text-sm font-medium border-2 transition-all text-left ${form.subject === subject ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-tg-hint/20 bg-tg-secondary text-tg-text active:bg-tg-text/5'}`}
              >
                {subject}
              </button>
            ))}
          </div>
          <button onClick={goNext} disabled={!canNext()}
            className="w-full bg-primary-600 text-white rounded-2xl py-3.5 font-medium disabled:bg-tg-text/10 disabled:text-tg-hint active:bg-primary-700 transition-colors">
            Keyingisi →
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">📖 Mavzu</h2>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            maxLength={400}
            placeholder="Masalan: Kasr sonlar"
            className="w-full border border-tg-text/10 rounded-2xl px-4 py-3.5 text-lg bg-tg-secondary focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-tg-text mb-1">
              Rasmlar (ixtiyoriy, 5 tagacha)
            </label>
            <label className="block w-full border-2 border-dashed border-primary-300 rounded-2xl p-4 text-center cursor-pointer hover:border-primary-500 transition-colors">
              <span className="text-tg-hint">📷 Rasm yuklash</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            {images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <ImageThumb file={img} />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.geo_extra}
                onChange={(e) => setForm({ ...form, geo_extra: e.target.checked, geographic_level: 'maktab' })}
                className="w-5 h-5 rounded-md border-tg-hint/30 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-tg-text">Viloyat yoki Respublika darajasida yozish kerak</span>
            </label>
            {form.geo_extra && (
              <div className="space-y-2 pl-8">
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.geographic_level === 'viloyat' ? 'border-primary-500 bg-primary-50' : 'border-tg-hint/20 bg-tg-secondary'}`}>
                  <input type="radio" name="geo" value="viloyat" checked={form.geographic_level === 'viloyat'}
                    onChange={() => setForm({ ...form, geographic_level: 'viloyat' })} className="w-4 h-4 text-primary-600" />
                  <div className="text-sm">
                    <p className="font-medium text-tg-text">🏢 Viloyat darajasi</p>
                    <p className="text-xs text-tg-hint">Viloyat miqyosida sifat kafolati</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-amber-600">+60,000</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.geographic_level === 'respublika' ? 'border-primary-500 bg-primary-50' : 'border-tg-hint/20 bg-tg-secondary'}`}>
                  <input type="radio" name="geo" value="respublika" checked={form.geographic_level === 'respublika'}
                    onChange={() => setForm({ ...form, geographic_level: 'respublika' })} className="w-4 h-4 text-primary-600" />
                  <div className="text-sm">
                    <p className="font-medium text-tg-text">🏛 Respublika darajasi</p>
                    <p className="text-xs text-tg-hint">Respublika miqyosida premium sifat</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-amber-600">+110,000</span>
                </label>
              </div>
            )}
          </div>

          <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasPromo}
                onChange={(e) => {
                  setHasPromo(e.target.checked)
                  if (!e.target.checked) { setPromoCode(''); setPromoDiscount(0); setPromoCodeId(null); setPromoError('') }
                }}
                className="w-5 h-5 rounded-md border-tg-hint/30 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-tg-text">Menda promokod bor</span>
            </label>
            {hasPromo && (
              <div className="space-y-2 pl-8">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Promo-kodni kiriting"
                    className="flex-1 px-3 py-2 rounded-xl border border-tg-hint/20 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-tg-secondary uppercase"
                  />
                  <button
                    onClick={validatePromo}
                    disabled={promoChecking || !promoCode.trim()}
                    className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 shrink-0"
                  >
                    {promoChecking ? '⏳' : 'Tekshirish'}
                  </button>
                </div>
                {promoError && <p className="text-sm text-red-500">{promoError}</p>}
                {promoDiscount > 0 && (
                  <p className="text-sm text-green-600 font-medium">✅ Chegirma qo'llanildi: -{promoDiscount.toLocaleString()} so'm</p>
                )}
              </div>
            )}
          </div>

          {referralDiscountAmount > 0 && referralBalance >= referralDiscountAmount && (
            <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useReferral}
                  onChange={(e) => setUseReferral(e.target.checked)}
                  className="w-5 h-5 rounded-md border-tg-hint/30 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-tg-text">Taklif chegirmadan foydalanish</span>
              </label>
              {useReferral && (
                <div className="pl-8 space-y-1">
                  <p className="text-xs text-tg-hint">Balans: {referralBalance.toLocaleString()} so'm</p>
                  <p className="text-sm text-green-600 font-medium">-{referralDiscountAmount.toLocaleString()} so'm kamayadi</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-tg-secondary rounded-2xl p-4 border border-tg-text/5">
            <h3 className="font-semibold mb-2">📋 Buyurtma ma'lumotlari:</h3>
            <div className="text-sm text-tg-hint space-y-1">
              <p className="break-words"><strong>F.I.Sh:</strong> {form.full_name}</p>
              <p className="break-words"><strong>Manzil:</strong> {form.region}, {form.district}</p>
              <p className="break-words"><strong>Maktab:</strong> {form.school}</p>
              <p className="break-words"><strong>Maktab turi:</strong> {SCHOOL_TYPES.find(s => s.id === form.school_type)?.label || '—'}</p>
              <p><strong>Sinf:</strong> {form.grade}-sinf</p>
              <p><strong>Fan:</strong> {form.subject}</p>
              <p className="break-all"><strong>Mavzu:</strong> {form.topic}</p>
              {images.length > 0 && <p><strong>Rasmlar:</strong> {images.length} ta</p>}
              <div className="pt-2 mt-2 border-t border-tg-text/10 space-y-1">
                <div className="flex justify-between text-sm text-tg-hint">
                  <span>Xizmat narxi:</span>
                  <span>{service.price.toLocaleString()} so'm</span>
                </div>
                {langSurcharge > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Boshqa tilda yozish uchun:</span>
                    <span>+{langSurcharge.toLocaleString()} so'm</span>
                  </div>
                )}
                {geoSurcharge > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>{form.geographic_level === 'viloyat' ? 'Viloyat darajasi:' : 'Respublika darajasi:'}</span>
                    <span>+{geoSurcharge.toLocaleString()} so'm</span>
                  </div>
                )}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Promo-kod chegirmasi:</span>
                    <span>-{promoDiscount.toLocaleString()} so'm</span>
                  </div>
                )}
                {activeReferralDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Taklif chegirmasi:</span>
                    <span>-{activeReferralDiscount.toLocaleString()} so'm</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-tg-text/10">
                  <span className="font-bold text-tg-text">Jami to'lov:</span>
                  <span className="font-bold text-primary-600 text-lg">{totalPrice.toLocaleString()} so'm</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={!form.topic.trim() || submitting}
            className="w-full bg-primary-600 text-white rounded-2xl py-3.5 font-medium disabled:bg-tg-text/10 disabled:text-tg-hint active:bg-primary-700 transition-colors"
          >
            ✅ Buyurtma berish
          </button>
        </div>
      )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-tg-text/40" onClick={() => !submitting && setShowConfirm(false)}>
          <div className="bg-tg-secondary rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-center">Tasdiqlaysizmi?</h3>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-tg-hint">Xizmat:</span><span className="font-medium">{service?.name}</span></div>
              <div className="flex justify-between"><span className="text-tg-hint">F.I.Sh:</span><span className="font-medium">{form.full_name}</span></div>
              <div className="flex justify-between"><span className="text-tg-hint">Manzil:</span><span className="font-medium">{form.region}, {form.district}</span></div>
              <div className="flex justify-between"><span className="text-tg-hint">Maktab:</span><span className="font-medium">{form.school}</span></div>
              <div className="flex justify-between"><span className="text-tg-hint">Fan:</span><span className="font-medium">{form.subject}</span></div>
              <div className="flex justify-between"><span className="text-tg-hint">Sinf:</span><span className="font-medium">{form.grade}</span></div>
              {form.topic && <div className="flex justify-between"><span className="text-tg-hint">Mavzu:</span><span className="font-medium text-right max-w-[60%]">{form.topic}</span></div>}
              <div className="border-t border-tg-text/10 pt-2 mt-2 flex justify-between items-center">
                <span className="font-bold">Jami to'lov:</span>
                <span className="font-bold text-primary-600 text-lg">{totalPrice.toLocaleString()} so'm</span>
              </div>
            </div>
            <p className="text-xs text-tg-hint text-center mb-4">To'lov uchun 5 daqiqa vaqt bor. Chekni yuklang.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-medium bg-tg-secondary text-tg-text active:bg-tg-text/5 transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleSubmit(); }}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-medium bg-primary-600 text-white active:bg-primary-700 transition-colors disabled:bg-tg-text/10 disabled:text-tg-hint"
              >
                {submitting ? 'Yuborilmoqda...' : '✅ Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderForm
