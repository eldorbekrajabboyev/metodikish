const { TelegramBot } = require('node-telegram-bot-api');
const { queryAll, queryOne, run } = require('./database');
const fs = require('fs');
const path = require('path');

let botInstance = null;

function nowUZ() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' });
}

async function deleteOrderImages(orderId) {
  const images = await queryAll('SELECT image_path FROM order_images WHERE order_id = ?', [orderId]);
  for (const img of images) {
    const filePath = path.join(__dirname, '..', img.image_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  await run('DELETE FROM order_images WHERE order_id = ?', [orderId]);
}

async function getChannels() {
  const row = await queryOne("SELECT value FROM settings WHERE key = 'channels'");
  if (!row || !row.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeChannelLink(link) {
  if (link.match(/^-?\d+$/)) return link;
  const match = link.match(/(?:t\.me|telegram\.me)\/(.+)/);
  if (match) return '@' + match[1];
  if (link.startsWith('@')) return link;
  return '@' + link;
}

async function checkSubscription(bot, userId) {
  const channels = await getChannels();
  if (channels.length === 0) return true;
  for (const ch of channels) {
    const chatId = normalizeChannelLink(ch.link);
    try {
      const member = await bot.getChatMember(chatId, userId);
      if (['left', 'kicked'].includes(member.status)) return false;
    } catch (e) {
      console.error(`Subscription check failed for ${ch.link} (${chatId}):`, e.message);
      return false;
    }
  }
  return true;
}

async function startBot(app) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN is required');
  }

  const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
  const crypto = require('crypto');
  const webhookPath = `/webhook/${crypto.randomUUID()}`;
  
  let bot;

  try {
    const tempBot = new TelegramBot(BOT_TOKEN);
    const webhookInfo = await tempBot.getWebhookInfo();
    console.log(`🔍 Current webhook: ${webhookInfo.url ? 'set (hidden)' : 'none'}`);
    if (webhookInfo.url) {
      await tempBot.deleteWebHook();
      console.log('🗑️ Deleted old webhook');
    }
  } catch (e) {
    console.error('⚠️ Could not check/clear old webhook:', e.message);
  }
  
  if (WEBHOOK_URL && WEBHOOK_URL.startsWith('https://')) {
    try {
      bot = new TelegramBot(BOT_TOKEN);
      const crypto = require('crypto');
      const webhookSecret = process.env.WEBHOOK_SECRET || crypto.randomUUID();
      app.post(webhookPath, (req, res) => {
        const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
        if (secretHeader !== webhookSecret) {
          return res.sendStatus(403);
        }
        try { bot.processUpdate(req.body); } catch (e) { console.error('Webhook error:', e.message); }
        res.sendStatus(200);
      });
      const result = await bot.setWebHook(`${WEBHOOK_URL}${webhookPath}`, { secret_token: webhookSecret });
      if (result) {
        console.log(`🤖 Bot webhook set: ${webhookPath}`);
      } else {
        throw new Error('setWebHook returned false');
      }
    } catch (whErr) {
      console.error('⚠️ Webhook setup failed, falling back to polling:', whErr.message);
      bot = new TelegramBot(BOT_TOKEN, { polling: { interval: 2000, params: { timeout: 30 } } });
      console.log('🤖 Bot polling mode started (fallback)');
    }
  } else {
    bot = new TelegramBot(BOT_TOKEN, { polling: { interval: 2000, params: { timeout: 30 } } });
    console.log('🤖 Bot polling mode started');
  }
  
  botInstance = bot;

  // Recover stuck pending_payment orders from previous server run
  try {
    const staleOrders = await queryAll(
      "SELECT id, order_code, user_id, promo_code_id, referral_discount FROM orders WHERE status = 'pending_payment'",
      []
    );
    const userIdMap = {};
    for (const o of staleOrders) {
      if (!userIdMap[o.user_id]) {
        const u = await queryOne('SELECT telegram_id FROM users WHERE id = ?', [o.user_id]);
        userIdMap[o.user_id] = u ? u.telegram_id : null;
      }
      const tid = userIdMap[o.user_id];
      await deleteOrderImages(o.id);
      await run(
        "UPDATE orders SET status = 'rejected', admin_note = 'Avtomatik bekor qilindi: server qayta ishga tushganda muddati o''tgan' WHERE id = ? AND status = 'pending_payment'",
        [o.id]
      );
      if (o.promo_code_id) {
        await run('DELETE FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ? AND order_id = ?', [o.promo_code_id, o.user_id, o.id]);
      }
      if (o.referral_discount > 0) {
        await run('UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?', [o.referral_discount, o.user_id]);
      }
      if (tid) {
        bot.sendMessage(tid, `❌ *Buyurtma bekor qilindi!*\n\n📋 #${o.order_code}\n\n⏱ To'lov muddati o'tgan (server qayta ishga tushdi).`).catch(() => {});
      }
    }
    if (staleOrders.length > 0) console.log(`🧹 Recovered ${staleOrders.length} stuck pending_payment orders`);
  } catch (e) {
    console.error('⚠️ Payment recovery error:', e.message);
  }
  console.log('🤖 Metodikish Bot started');

  async function ensureUser(tgUser) {
    const existing = await queryOne('SELECT * FROM users WHERE telegram_id = ?', [tgUser.id]);
    if (existing) {
      await run('UPDATE users SET username = ?, first_name = ?, last_name = ? WHERE telegram_id = ?',
        [tgUser.username, tgUser.first_name, tgUser.last_name, tgUser.id]);
      return await queryOne('SELECT * FROM users WHERE telegram_id = ?', [tgUser.id]);
    }
    const result = await run('INSERT INTO users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
      [tgUser.id, tgUser.username, tgUser.first_name, tgUser.last_name]);
    return await queryOne('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
  }

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startParam = match && match[1] ? match[1] : null;
    const user = await ensureUser(msg.from);

    if (startParam && startParam.startsWith('ref_')) {
      const referrerTelegramId = parseInt(startParam.replace('ref_', ''));
      if (referrerTelegramId && referrerTelegramId !== msg.from.id && !user.referred_by) {
        const referrer = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [referrerTelegramId]);
        if (referrer) {
          await run('UPDATE users SET referred_by = ? WHERE id = ?', [referrer.id, user.id]);
        }
      }
    }

    const channels = await getChannels();
    if (channels.length > 0) {
      const isSubscribed = await checkSubscription(bot, msg.from.id);
      if (!isSubscribed) {
        const channelList = channels.map((ch, i) => `${i + 1}. ${ch.name}`).join('\n');
        bot.sendMessage(chatId,
          `👋 *Ro'yxatdan o'tish*\n\n` +
          `Botni ishlatish uchun quyidagi kanallarga obuna bo'ling:\n\n` +
          `${channelList}\n\n` +
          `Obuna bo'lgandan keyin "✅ Obunani tekshirish" tugmasini bosing.`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
            ...channels.map(ch => [{ text: `📢 ${ch.name}`, url: ch.link }]),
            [{ text: '✅ Obunani tekshirish', callback_data: 'check_subscription' }],
          ]}}
        );
        return;
      }
    }

    if (!user.phone) {
      bot.sendMessage(chatId,
        `👋 *Ro'yxatdan o'tish*\n\n` +
        `Iltimos, telefon raqamingizni yuboring:`,
        { parse_mode: 'Markdown', reply_markup: { keyboard: [
          [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
        ], one_time_keyboard: true, resize_keyboard: true }}
      );
      return;
    }

    bot.sendMessage(chatId,
      `🎓 *Metodikish* ga xush kelibsiz!\n\n` +
      `Biz sizga metodik qo'llanma va metodik tavsiya hujjatlarini tayyorlab beramiz.\n\n` +
      `Quyidagi tugmalardan birini tanlang:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
        [{ text: '📱 Xizmatlar App', web_app: { url: 'https://metodikish.fly.dev/' } }],
        [{ text: '📦 Buyurtmalarim', callback_data: 'my_orders' }],
        [{ text: "ℹ️ Ma'lumot", callback_data: 'info' }],
      ]}}
    );
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const telegramId = query.from.id;

    await ensureUser(query.from);

    if (data === 'check_subscription') {
      const isSubscribed = await checkSubscription(bot, telegramId);
      if (isSubscribed) {
        bot.sendMessage(chatId,
          `👋 *Ro'yxatdan o'tish*\n\n` +
          `Iltimos, telefon raqamingizni yuboring:`,
          { parse_mode: 'Markdown', reply_markup: { keyboard: [
            [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
          ], one_time_keyboard: true, resize_keyboard: true }}
        );
      } else {
        const channels = await getChannels();
        const channelList = channels.map((ch, i) => `${i + 1}. ${ch.name}`).join('\n');
        bot.sendMessage(chatId,
          `❌ *Siz hali barcha kanallarga obuna bo'lmagansiz!*\n\n` +
          `Quyidagi kanallarga obuna bo'ling:\n\n` +
          `${channelList}\n\n` +
          `Obuna bo'lgandan keyin "✅ Obunani tekshirish" tugmasini bosing.`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
            ...channels.map(ch => [{ text: `📢 ${ch.name}`, url: ch.link }]),
            [{ text: '✅ Obunani tekshirish', callback_data: 'check_subscription' }],
          ]}}
        );
      }
      bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'back_main') {
      bot.sendMessage(chatId, '🏠 Asosiy menyu:', { reply_markup: { inline_keyboard: [
        [{ text: '📱 Xizmatlar App', web_app: { url: 'https://metodikish.fly.dev/' } }],
        [{ text: '📦 Buyurtmalarim', callback_data: 'my_orders' }],
        [{ text: "ℹ️ Ma'lumot", callback_data: 'info' }],
      ]}});
    }

    if (data === 'info') {
      bot.sendMessage(chatId,
        `📖 *Metodikish* — O'qituvchilar uchun metodik hujjatlar tayyorlash xizmati.\n\n` +
        `📝 *Metodik Qo'llanma* — Batafsil metodik qo'llanma\n` +
        `📋 *Metodik Tavsiya* — Metodik tavsiya hujjati\n\n` +
        `⏰ Tayyorlash muddati: 5-6 soat\n` +
        `💳 To'lov: Kartaga o'tkazma orqali`,
        { parse_mode: 'Markdown' }
      );
    }

    if (data === 'my_orders') {
      const user = await queryOne('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
      if (!user) { bot.answerCallbackQuery(query.id); return bot.sendMessage(chatId, "Siz hali ro'yxatdan o'tmagansiz."); }
      const orders = await queryAll(`SELECT o.*, s.name as service_name FROM orders o LEFT JOIN services s ON o.service_id = s.id WHERE o.user_id = ? ORDER BY o.created_at DESC`, [user.id]);
      if (orders.length === 0) { bot.answerCallbackQuery(query.id); return bot.sendMessage(chatId, "📦 Sizda hali buyurtmalar mavjud emas."); }
      const statusMap = { pending_payment: "💳 To'lov kutilmoqda", pending_confirmation: "🔍 To'lov tekshirilmoqda", in_progress: '📝 Tayyorlanmoqda', ready: '✅ Tayyor', sent: '📤 Yuborildi', rejected: '❌ Rad etildi' };
      const text = orders.map(o => `*${o.order_code}*\n📋 ${o.service_name}\n📊 ${statusMap[o.status] || o.status}\n💰 ${o.total_price.toLocaleString()} so'm`).join('\n\n');
      bot.sendMessage(chatId, `📦 *Buyurtmalarim:*\n\n${text}`, { parse_mode: 'Markdown' });
    }

    bot.answerCallbackQuery(query.id);
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (msg.contact) {
      try {
        const user = await queryOne('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
        if (user && !user.phone) {
          await run('UPDATE users SET phone = ? WHERE telegram_id = ?', [msg.contact.phone_number, telegramId]);
          await bot.sendMessage(chatId,
            `✅ *Ro'yxatdan o'tish yakunlandi!*\n\n` +
            `Telefon: ${msg.contact.phone_number}\n\n` +
            `Endi botni to'liq ishlatishingiz mumkin.`,
            { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
          );
          setTimeout(() => {
            bot.sendMessage(chatId,
              `🎓 *Metodikish* ga xush kelibsiz!\n\n` +
              `Quyidagi tugmalardan birini tanlang:`,
              { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                [{ text: '📱 Xizmatlar App', web_app: { url: 'https://metodikish.fly.dev/' } }],
                [{ text: '📦 Buyurtmalarim', callback_data: 'my_orders' }],
                [{ text: "ℹ️ Ma'lumot", callback_data: 'info' }],
              ]}}
            );
          }, 1000);
        } else if (user && user.phone) {
          await bot.sendMessage(chatId,
            `✅ Siz allaqachon ro'yxatdan o'tgansiz.\nTelefon: ${user.phone}`,
            { reply_markup: { remove_keyboard: true } }
          );
          setTimeout(() => {
            bot.sendMessage(chatId,
              `🎓 *Metodikish* ga xush kelibsiz!`,
              { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                [{ text: '📱 Xizmatlar App', web_app: { url: 'https://metodikish.fly.dev/' } }],
                [{ text: '📦 Buyurtmalarim', callback_data: 'my_orders' }],
                [{ text: "ℹ️ Ma'lumot", callback_data: 'info' }],
              ]}}
            );
          }, 1000);
        }
      } catch (err) {
        console.error('Contact handler error:', err.message);
        bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
      }
      return;
    }
  });

  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
    if (ADMIN_CHAT_ID && String(msg.from.id) === ADMIN_CHAT_ID) {
      const totalOrders = (await queryOne('SELECT COUNT(*) as count FROM orders')).count;
      const pendingPayment = (await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'pending_payment'")).count;
      const pendingConfirmation = (await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'pending_confirmation'")).count;
      const inProgress = (await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'in_progress'")).count;
      const ready = (await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'ready'")).count;
      const sent = (await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'sent'")).count;
      const totalRevenueResult = await queryOne("SELECT COALESCE(SUM(total_price), 0) as total FROM orders WHERE status IN ('in_progress', 'ready', 'sent')");
      const totalRevenue = totalRevenueResult ? totalRevenueResult.total : 0;

      bot.sendMessage(chatId,
        `📊 *Admin Panel*\n\n📦 Jami buyurtmalar: ${totalOrders}\n💳 To'lov kutilmoqda: ${pendingPayment}\n🔍 Tekshirilmoqda: ${pendingConfirmation}\n📝 Tayyorlanmoqda: ${inProgress}\n✅ Tayyor: ${ready}\n📤 Yuborilgan: ${sent}\n💰 Jami daromad: ${totalRevenue.toLocaleString()} so'm`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  return bot;
}

function getBotInstance() {
  return botInstance;
}

module.exports = { startBot, getBotInstance };
