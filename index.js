require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const http = require('http');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_USERNAME = 'Diary1031'; // သင့်ရဲ့ Username အသစ်
const PDF_FILE_PATH = process.env.PDF_FILE_PATH || './Rebuild-Your-Self-Esteem-in-7-Days.pdf';
const PORT = process.env.PORT || 3000;
const VIP_BOOK_CLUB_LINK = 'https://t.me/+eboPYDMzR7VlMzU1';

// --- PRODUCT LIST (နောက်ပိုင်း ဒီမှာ အလွယ်တကူ ထပ်တိုးနိုင်ပါတယ်) ---
const products = [
  { id: 'self_respect', name: '📘 7-Day Self-Respect System', price: '20,000 ks', category: 'Ebooks' },
  // { id: 'new_book', name: '📙 New Ebook Name', price: '15,000 ks', category: 'Ebooks' }, // နမူနာ ဖြည့်စွက်ပုံ
];

const faqContent = "❓ **အမေးများသော မေးခွန်းများ**\n\n၁။ ငွေလွှဲပြီး ဘယ်လောက်ကြာရင် Ebook ရမလဲ?\n- Admin က screenshot စစ်ဆေးပြီး ၁ နာရီအတွင်း ပို့ပေးပါတယ်။\n\n၂။ Refund ရနိုင်မလား?\n- ၇ ရက်အတွင်း စမ်းသပ်လို့ မပြောင်းလဲရင် ၁၀၀% ပြန်အမ်းပေးပါတယ်။";

if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN is not defined.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const users = {}; // In-memory database (Render Free Plan မှာ restart ဖြစ်ရင် reset ဖြစ်နိုင်ပါတယ်)

// Health Check Server
http.createServer((req, res) => { res.writeHead(200); res.end('Bot is Active'); }).listen(PORT);

// --- MAIN MENU ---
const mainMenu = (ctx) => {
  return ctx.reply(
    '👋 မင်္ဂလာပါ! Diary Book Store မှ ကြိုဆိုပါတယ်။\n\nအောက်ပါခလုတ်များကို အသုံးပြုနိုင်ပါတယ် -',
    Markup.inlineKeyboard([
      [Markup.button.callback('🛍️ Browse Products', 'browse_categories')],
      [Markup.button.callback('❓ မေးခွန်းများ (FAQ)', 'show_faq')],
      [Markup.button.url('📞 Contact Admin', `https://t.me/${ADMIN_USERNAME}`)]
    ])
  );
};

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  users[userId] = { id: userId, username: ctx.from.username || ctx.from.first_name, paymentConfirmed: false };
  await mainMenu(ctx);
});

// --- CATEGORIES & PRODUCTS ---
bot.action('browse_categories', async (ctx) => {
  await ctx.editMessageText('📂 အမျိုးအစားကို ရွေးချယ်ပါ -', 
    Markup.inlineKeyboard([
      [Markup.button.callback('📚 Ebooks', 'cat_Ebooks')],
      [Markup.button.callback('🎓 Courses (Soon)', 'cat_Courses')],
      [Markup.button.callback('🔙 Back', 'back_to_start')]
    ])
  );
});

bot.action(/^cat_(.+)$/, async (ctx) => {
  const category = ctx.match[1];
  const filteredProducts = products.filter(p => p.category === category);
  
  if (filteredProducts.length === 0) {
    return ctx.answerCbQuery('ဒီအမျိုးအစားမှာ ပစ္စည်းမရှိသေးပါခင်ဗျာ။');
  }

  const buttons = filteredProducts.map(p => [Markup.button.callback(p.name, `prod_${p.id}`)]);
  buttons.push([Markup.button.callback('🔙 Back', 'browse_categories')]);

  await ctx.editMessageText(`${category} များ -`, Markup.inlineKeyboard(buttons));
});

// --- PRODUCT FUNNEL ---
bot.action('prod_self_respect', async (ctx) => {
  await ctx.reply('📘 7-Day Self-Respect System\n\nSelf-esteem ကို ပြန်တည်ဆောက်ချင်လား?\n\nဒီ system က:\n✔ 7 days execution plan\n✔ Daily discipline system\n✔ Self-trust rebuild method',
    Markup.inlineKeyboard([[Markup.button.callback('Continue', 'see_solution')]]));
});

bot.action('see_solution', async (ctx) => {
  await ctx.editMessageText('Day 1-3 → Discipline\nDay 4-5 → No excuses\nDay 6-7 → Momentum\n\nGoal: Confidence!',
    Markup.inlineKeyboard([[Markup.button.callback('Get Access', 'get_access')]]));
});

bot.action('get_access', async (ctx) => {
  await ctx.editMessageText('💰 Price – 20,000 ks\n🎁 Bonus: VIP Book Club\n🔁 100% Refund Guarantee',
    Markup.inlineKeyboard([[Markup.button.callback('Buy Now', 'buy_now')]]));
});

bot.action('buy_now', async (ctx) => {
  await ctx.reply('💳 Payment:\nKpay – 09793101410 (kyaw chit koko)\nWave – 09976216414 (kyaw chit koko)\n\n👉 Screenshot ပို့ပြီး Confirm နှိပ်ပါ',
    Markup.inlineKeyboard([[Markup.button.callback('I\'ve Paid', 'i_have_paid')]]));
});

bot.action('i_have_paid', async (ctx) => { await ctx.reply('📸 Screenshot ပို့ပေးပါခင်ဗျာ။'); });

bot.action('show_faq', async (ctx) => {
  await ctx.reply(faqContent, Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'back_to_start')]]));
});

bot.action('back_to_start', async (ctx) => { await ctx.editMessageText('Main Menu သို့ ပြန်ရောက်ပါပြီ။'); await mainMenu(ctx); });

// --- PHOTO HANDLING ---
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  
  try {
    await ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
      caption: `📩 Payment from: ${ctx.from.first_name} (ID: ${userId})\n\nAdmin Actions:\n/confirm ${userId}\n/reject ${userId}`
    });
    await ctx.reply('✅ Screenshot ရရှိပါပြီ။ Admin စစ်ဆေးပြီးနောက် အကြောင်းကြားပေးပါမည်။');
  } catch (e) { console.error(e); }
});

// --- ADMIN COMMANDS ---
bot.command('confirm', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const targetId = ctx.message.text.split(' ')[1];
  if (!targetId) return ctx.reply('Usage: /confirm <user_id>');

  try {
    await ctx.telegram.sendMessage(targetId, '✅ သင့်ငွေလွှဲမှုကို အတည်ပြုပြီးပါပြီ။ Ebook ကို ပို့ပေးလိုက်ပါတယ်။');
    if (fs.existsSync(PDF_FILE_PATH)) {
      await ctx.telegram.sendDocument(targetId, { source: PDF_FILE_PATH }, { caption: '📘 Your Ebook' });
    }
    await ctx.telegram.sendMessage(targetId, `🎁 VIP Book Club: ${VIP_BOOK_CLUB_LINK}`);
    await ctx.reply(`User ${targetId} ကို အတည်ပြုပြီးပါပြီ။`);
  } catch (e) { ctx.reply('Error: ' + e.message); }
});

bot.command('reject', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const targetId = ctx.message.text.split(' ')[1];
  try {
    await ctx.telegram.sendMessage(targetId, '❌ သင့်ငွေလွှဲမှု မှားယွင်းနေပါသည်။ ကျေးဇူးပြု၍ Admin ကို ပြန်လည်ဆက်သွယ်ပေးပါ။');
    await ctx.reply(`User ${targetId} ကို Reject လုပ်ပြီးပါပြီ။`);
  } catch (e) { console.error(e); }
});

bot.command('orders', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const list = Object.values(users).map(u => `- ${u.username} (${u.id})`).join('\n') || 'No users yet.';
  await ctx.reply(`📊 လက်ရှိအသုံးပြုသူများ:\n${list}`);
});

bot.command('broadcast', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const msg = ctx.message.text.split(' ').slice(1).join(' ');
  if (!msg) return ctx.reply('Usage: /broadcast <message>');
  
  for (const userId in users) {
    try { await ctx.telegram.sendMessage(userId, `📢 **Admin Message:**\n\n${msg}`); } catch (e) { console.error(e); }
  }
  await ctx.reply('✅ Broadcast ပို့ပြီးပါပြီ။');
});

bot.launch();
console.log('Bot is running with Admin features...');
