require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:3000';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required in .env file');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Metodikish Bot started');

// ==================== HELPERS ====================

async function apiGet(path) {
  const res = await axios.get(`${API_URL}/api${path}`);
  return res.data;
}

async function apiPost(path, data) {
  const res = await axios.post(`${API_URL}/api${path}`, data);
  return res.data;
}

async function apiPut(path, data) {
  const res = await axios.put(`${API_URL}/api${path}`, data);
  return res.data;
}

async function ensureUser(msg) {
  const tg = msg.from;
  return apiPost('/users', {
    telegram_id: tg.id,
    username: tg.username,
    first_name: tg.first_name,
    last_name: tg.last_name,
  });
}

// ==================== COMMANDS ====================

// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUser(msg);

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📚 Xizmatlar', callback_data: 'services' }],
        [{ text: '📦 Buyurtmalarim', callback_data: 'my_orders' }],
        [{ text: 'ℹ️ Ma\'lumot', callback_data: 'info' }],
      ],
    },
  };

  bot.sendMessage(
    chatId,
    `🎓 *Metodikish* ga xush kelibsiz!\n\n` +
    `Biz sizga metodik qo'llanma va metodik tavsiya hujjatlarini tayyorlab beramiz.\n\n` +
    `Quyidagi tugmalardan birini tanlang:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
});

// ==================== CALLBACK QUERIES ====================

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const telegramId = query.from.id;

  await ensureUser(query);

  if (data === 'services') {
    const services = await apiGet('/services');
    const activeServices = services.filter(s => s.is_active);

    if (activeServices.length === 0) {
      return bot.sendMessage(chatId, 'Hozircha xizmatlar mavjud emas.');
    }

    const buttons = activeServices.map(s => [
      { text: `${s.name} - ${s.price.toLocaleString()} so'm`, callback_data: `order_${s.id}` }
    ]);
    buttons.push([{ text: '🔙 Orqaga', callback_data: 'back_main' }]);

    bot.sendMessage(chatId, '📚 *Xizmatlar ro\'yxati:*\n\nTanlang:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  if (data === 'back_main') {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📚 Xizmatlar', callback_data: 'services' }],
          [{ text: '📦 Buyurtmalarim', callback_data: 'my_orders' }],
          [{ text: 'ℹ️ Ma\'lumot', callback_data: 'info' }],
        ],
      },
    };
    bot.sendMessage(chatId, '🏠 Asosiy menyu:', keyboard);
  }

  if (data === 'info') {
    bot.sendMessage(
      chatId,
      `📖 *Metodikish* — O'qituvchilar uchun metodik hujjatlar tayyorlash xizmati.\n\n` +
      `📝 *Metodik Qo'llanma* — Batafsil metodik qo'llanma\n` +
      `📋 *Metodik Tavsiya* — Metodik tavsiya hujjati\n\n` +
      `⏰ Tayyorlash muddati: 5-6 soat\n` +
      `💳 To'lov: Kartaga o'tkazma orqali`,
      { parse_mode: 'Markdown' }
    );
  }

  if (data === 'my_orders') {
    const user = await apiGet(`/users/${telegramId}`);
    if (!user) return bot.sendMessage(chatId, 'Siz hali ro\'yxatdan o\'tmagansiz.');

    const orders = await apiGet(`/user/orders/${telegramId}`);
    if (orders.length === 0) {
      return bot.sendMessage(chatId, '📦 Sizda hali buyurtmalar mavjud emas.');
    }

    const statusMap = {
      pending_payment: '💳 To\'lov kutilmoqda',
      pending_confirmation: '🔍 To\'lov tekshirilmoqda',
      in_progress: '📝 Tayyorlanmoqda',
      ready: '✅ Tayyor',
      sent: '📤 Yuborildi',
      rejected: '❌ Rad etildi',
    };

    const text = orders.map(o =>
      `*${o.order_code}*\n📋 ${o.service_name}\n📊 ${statusMap[o.status] || o.status}\n💰 ${o.total_price.toLocaleString()} so'm`
    ).join('\n\n');

    bot.sendMessage(chatId, `📦 *Buyurtmalarim:*\n\n${text}`, { parse_mode: 'Markdown' });
  }

  // Order creation flow
  if (data.startsWith('order_')) {
    const serviceId = data.split('_')[1];
    const service = (await apiGet('/services')).find(s => s.id == serviceId);
    if (!service) return;

    // Store order state in memory (for simplicity)
    if (!global.userStates) global.userStates = {};
    global.userStates[telegramId] = {
      step: 'full_name',
      service_id: serviceId,
      service_name: service.name,
      service_price: service.price,
      _ts: Date.now(),
      _ttl: 1800000, // 30 minutes
    };

    bot.sendMessage(
      chatId,
      `📝 *${service.name}* buyurtmasini berish\n\n` +
      `Iltimos, to'liq F.I.Sh ni kiriting:`,
      { parse_mode: 'Markdown' }
    );
  }

  bot.answerCallbackQuery(query.id);
});

// ==================== STATE CLEANUP ====================

function cleanupExpiredStates() {
  const now = Date.now();
  if (global.userStates) {
    for (const [key, state] of Object.entries(global.userStates)) {
      if (state._ts && now - state._ts > (state._ttl || 1800000)) {
        delete global.userStates[key];
      }
    }
  }
  if (global.receiptStates) {
    for (const [key, state] of Object.entries(global.receiptStates)) {
      if (state._ts && now - state._ts > (state._ttl || 1800000)) {
        delete global.receiptStates[key];
      }
    }
  }
}
setInterval(cleanupExpiredStates, 300000); // Har 5 daqiqada tozalash

// ==================== ORDER FLOW MESSAGES ====================

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (!global.userStates || !global.userStates[telegramId]) return;

  const state = global.userStates[telegramId];

  switch (state.step) {
    case 'full_name':
      state.full_name = msg.text;
      state.step = 'address';
      bot.sendMessage(chatId, '📍 Yashash manzilingizni kiriting:');
      break;

    case 'address':
      state.address = msg.text;
      state.step = 'school';
      bot.sendMessage(chatId, '🏫 Maktab nomi/sonini kiriting:');
      break;

    case 'school':
      state.school = msg.text;
      state.step = 'subject';
      bot.sendMessage(chatId, '📚 Fan nomini kiriting:');
      break;

    case 'subject':
      state.subject = msg.text;
      state.step = 'grade';
      bot.sendMessage(chatId, '🎓 Nechinchi sinf? (masalan: 5-sinf):');
      break;

    case 'grade':
      state.grade = msg.text;
      state.step = 'topic';
      bot.sendMessage(chatId, '📖 Mavzuni kiriting:');
      break;

    case 'topic':
      state.topic = msg.text;
      state.step = 'images';
      bot.sendMessage(
        chatId,
        '🖼 Rasm yuklamoqchimisiz? (5 tagacha)\n\n' +
        'Ha bo\'lsa, rasmlarni yuboring.\n' +
        'Yo\'q bo\'lsa, "O\'tkazib yuborish" deb yozing.'
      );
      break;

    case 'images':
      if (!state.images) state.images = [];
      if (msg.text && msg.text.toLowerCase() === "o'tkazib yuborish") {
        // Skip images, create order
        await createOrder(chatId, telegramId, state);
      } else if (msg.photo) {
        if (state.images.length >= 5) {
          bot.sendMessage(chatId, '⚠️ Maksimal 5 ta rasm yuklash mumkin. Endi buyurtma yaratilmoqda...');
          await createOrder(chatId, telegramId, state);
        } else {
          state.images.push(msg.photo[msg.photo.length - 1].file_id);
          bot.sendMessage(chatId, `✅ Rasm qabul qilindi (${state.images.length}/5). Yana yuboring yoki "Tayyor" deb yozing.`);
        }
      } else if (msg.text && msg.text.toLowerCase() === 'tayyor') {
        await createOrder(chatId, telegramId, state);
      }
      break;
  }
});

async function createOrder(chatId, telegramId, state) {
  try {
    const user = await apiGet(`/users/${telegramId}`);

    const order = await apiPost('/orders', {
      user_id: user.id,
      service_id: state.service_id,
      full_name: state.full_name,
      address: state.address,
      school: state.school,
      subject: state.subject,
      grade: state.grade,
      topic: state.topic,
    });

    // Get payment card
    const cards = await apiGet('/user/active-cards');
    const card = cards[0];

    let paymentText = `✅ *Buyurtma yaratildi!*\n\n`;
    paymentText += `📋 Buyurtma raqami: *${order.order_code}*\n`;
    paymentText += `📝 Xizmat: ${state.service_name}\n`;
    paymentText += `💰 Narxi: ${state.service_price.toLocaleString()} so'm\n\n`;

    if (card) {
      paymentText += `💳 *To'lov kartasi:*\n`;
      paymentText += `\`${card.card_number}\`\n`;
      paymentText += `👤 ${card.card_holder}\n`;
      paymentText += `🏦 ${card.bank_name || ''}\n\n`;
      paymentText += `Pul o'tkazgandan so'ng chekni yuboring.`;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📤 Chek yuborish', callback_data: `send_receipt_${order.id}` }],
          [{ text: '🔙 Asosiy menyu', callback_data: 'back_main' }],
        ],
      },
    };

    bot.sendMessage(chatId, paymentText, { parse_mode: 'Markdown', ...keyboard });

    // Reset state
    delete global.userStates[telegramId];
  } catch (err) {
    const safeMsg = err.message ? err.message.replace(/bot\d+:[^/]+/g, 'bot***:REDACTED') : 'unknown';
    console.error('Order creation error:', safeMsg);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    delete global.userStates[telegramId];
  }
}

// Handle receipt upload
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;

  if (data.startsWith('send_receipt_')) {
    const orderId = data.split('_')[2];
    if (!global.receiptStates) global.receiptStates = {};
    global.receiptStates[query.from.id] = { order_id: orderId, _ts: Date.now(), _ttl: 1800000 };
    bot.sendMessage(chatId, '📸 Chek rasmini yuboring (rasm sifatida):');
    bot.answerCallbackQuery(query.id);
  }
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (!global.receiptStates || !global.receiptStates[telegramId]) return;

  const state = global.receiptStates[telegramId];
  const photo = msg.photo[msg.photo.length - 1];

  try {
    const file = await bot.getFile(photo.file_id);
    const botToken = process.env.BOT_TOKEN;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

    // Download and upload to server
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const FormData = require('form-data');
    const form = new FormData();
    form.append('receipt', response.data, { filename: 'receipt.jpg' });

    await axios.post(`${API_URL}/api/orders/${state.order_id}/receipt`, form, {
      headers: form.getHeaders(),
    });

    bot.sendMessage(
      chatId,
      '✅ Chek yuborildi!\n\nTo\'lov tekshirilgandan keyin hujjat tayyorlanadi.\n' +
      'Tayyor bo\'lgach sizga xabar beriladi.',
    );

    // Notify admin
    const settings = await apiGet('/settings');
    if (settings.admin_chat_id) {
      bot.sendMessage(
        settings.admin_chat_id,
        `🔔 *Yangi to'lov cheki!*\n\nBuyurtma: #${state.order_id}\nFoydalanuvchi: ${msg.from.first_name}`,
        { parse_mode: 'Markdown' }
      );
    }

    delete global.receiptStates[telegramId];
  } catch (err) {
    const safeMsg = err.message ? err.message.replace(/bot\d+:[^/]+/g, 'bot***:REDACTED') : 'unknown';
    console.error('Receipt upload error:', safeMsg);
    bot.sendMessage(chatId, '❌ Chek yuklashda xatolik. Qaytadan urinib ko\'ring.');
  }
});

// Admin commands
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const settings = await apiGet('/settings');

  if (String(msg.from.id) === settings.admin_chat_id) {
    const stats = await apiGet('/stats');
    bot.sendMessage(
      chatId,
      `📊 *Admin Panel*\n\n` +
      `📦 Jami buyurtmalar: ${stats.totalOrders}\n` +
      `💳 To\'lov kutilmoqda: ${stats.pendingPayment}\n` +
      `🔍 Tekshirilmoqda: ${stats.pendingConfirmation}\n` +
      `📝 Tayyorlanmoqda: ${stats.inProgress}\n` +
      `✅ Tayyor: ${stats.ready}\n` +
      `📤 Yuborilgan: ${stats.sent}\n` +
      `💰 Jami daromad: ${stats.totalRevenue.toLocaleString()} so'm`,
      { parse_mode: 'Markdown' }
    );
  }
});
