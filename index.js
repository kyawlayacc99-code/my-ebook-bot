require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const http = require('http');
const https = require('https');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_USERNAME = 'Diary1031'; 
const PDF_FILE_PATH = process.env.PDF_FILE_PATH || './Rebuild-Your-Self-Esteem-in-7-Days.pdf';
const PORT = process.env.PORT || 3000;
const APP_URL = 'https://my-ebook-sales-bot.onrender.com';
const VIP_BOOK_CLUB_LINK = 'https://t.me/+eboPYDMzR7VlMzU1';

if (!BOT_TOKEN) { process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);

// --- DATA STORAGE ---
// မှတ်ချက် - Render Free Plan သည် Restart ဖြစ်ပါက ဤအချက်အလက်များ Reset ဖြစ်နိုင်ပါသည်။
let products = [
  { id: 'self_respect', name: '📘 7-Day Self-Respect System', price: '20,000 ks', category: 'Ebooks' }
];
let users = {}; 

// --- SELF-PING SYSTEM (၅ မိနစ်တစ်ခါ နိုးပေးပါမည်) ---
setInterval(() => {
  https.get(APP_URL, (res) => console.log(`Ping: ${res.statusCode}`)).on('error', (e) => console.error(e));
}, 5 * 60 * 1000);

// Health Check Server
http.createServer((req, res) => { res.writeHead(200); res.end('Bot is Live'); }).listen(PORT);

// --- HELPER FUNCTIONS ---
const getMainMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('🛍️ Browse Products', 'browse_categories')],
  [Markup.button.callback('❓ FAQ (မေးခွန်းများ)', 'show_faq')],
  [Markup.button.url('📞 Contact Admin', `https://t.me/${ADMIN_USERNAME}`)]
]);

// --- USER COMMANDS ---
bot.start(async (ctx) => {
  users[ctx.from.id] = { id: ctx.from.id, username: ctx.from.username || ctx.from.first_name };
  await ctx.reply('👋 Diary Book Store မှ ကြိုဆိုပါတယ်။\n\nအောက်ပါခလုတ်များကို အသုံးပြုနိုင်ပါတယ် -', getMainMenu());
});

bot.action('back_to_start', async (ctx) => {
  await ctx.editMessageText('👋 Diary Book Store မှ ကြိုဆိုပါတယ်။', getMainMenu());
});

// --- PRODUCT BROWSER ---
bot.action('browse_categories', async (ctx) => {
  await ctx.editMessageText('📂 အမျိုးအစားကို ရွေးချယ်ပါ -', Markup.inlineKeyboard([
    [Markup.button.callback('📚 Ebooks', 'cat_Ebooks')],
    [Markup.button.callback('🎓 Courses', 'cat_Courses')],
    [Markup.button.callback('🔙 Back', 'back_to_start')]
  ]));
});

bot.action(/^cat_(.+)$/, async (ctx) => {
  const category = ctx.match[1];
  const filtered = products.filter(p => p.category === category);
  if (filtered.length === 0) return ctx.answerCbQuery('ဒီအမျိုးအစားမှာ ပစ္စည်းမရှိသေးပါ။');
  
  const buttons = filtered.map(p => [Markup.button.callback(p.name, `view_prod_${p.id}`)]);
  buttons.push([Markup.button.callback('🔙 Back', 'browse_categories')]);
  await ctx.editMessageText(`${category} များ -`, Markup.inlineKeyboard(buttons));
});

bot.action(/^view_prod_(.+)$/, async (ctx) => {
  const prod = products.find(p => p.id === ctx.match[1]);
  if (!prod) return ctx.answerCbQuery('Product not found.');
  await ctx.reply(`📦 **${prod.name}**\n💰 ဈေးနှုန်း: ${prod.price}\n\nဝယ်ယူရန် 'Buy Now' ကို နှိပ်ပါ -`, 
    Markup.inlineKeyboard([[Markup.button.callback('💳 Buy Now', 'buy_now')]]));
});

bot.action('buy_now', async (ctx) => {
  await ctx.reply('💳 Payment:\nKpay – 09793101410 (kyaw chit koko)\nWave – 09976216414 (kyaw chit koko)\n\n👉 Screenshot ပို့ပြီး Confirm နှိပ်ပါ',
    Markup.inlineKeyboard([[Markup.button.callback('📸 I\'ve Paid', 'i_have_paid')]]));
});

bot.action('i_have_paid', async (ctx) => { await ctx.reply('📸 ငွေလွှဲ Screenshot ပို့ပေးပါခင်ဗျာ။'); });
bot.action('show_faq', async (ctx) => { 
  await ctx.reply('❓ FAQ\n\n၁။ Ebook ဘယ်လိုရမလဲ? - Admin စစ်ပြီး ၁ နာရီအတွင်း ပို့ပေးပါတယ်။\n၂။ Refund ရမလား? - ၇ ရက်အတွင်း မပြောင်းလဲရင် ပြန်အမ်းပေးပါတယ်။', 
    Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'back_to_start')]])); 
});

// --- PHOTO HANDLING ---
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  try {
    await ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
      caption: `📩 Payment from: ${ctx.from.first_name} (ID: ${userId})\n\nAdmin Actions:`,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Confirm', `admin_confirm_${userId}`)],
        [Markup.button.callback('❌ Reject', `admin_reject_${userId}`)]
      ])
    });
    await ctx.reply('✅ Screenshot ရရှိပါပြီ။ Admin စစ်ဆေးပြီးနောက် အကြောင်းကြားပေးပါမည်။');
  } catch (e) { console.error(e); }
});

// --- ADMIN PANEL & COMMANDS ---
bot.command('admin', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  await ctx.reply('🛠️ **Admin Dashboard**', Markup.inlineKeyboard([
    [Markup.button.callback('📊 View Orders', 'admin_orders')],
    [Markup.button.callback('➕ Add Product', 'admin_add_help')],
    [Markup.button.callback('📢 Broadcast', 'admin_bc_help')]
  ]));
});

bot.action('admin_orders', async (ctx) => {
  const list = Object.values(users).map(u => `- ${u.username} (${u.id})`).join('\n') || 'No users.';
  await ctx.reply(`📊 လက်ရှိအသုံးပြုသူများ:\n${list}`);
});

bot.action('admin_add_help', async (ctx) => {
  await ctx.reply('➕ **Product ထည့်ရန်:**\n`/addproduct id | name | price | category` လို့ ရိုက်ပါ။\n\nဥပမာ:\n`/addproduct habit | Atomic Habit | 15,000 | Ebooks`');
});

bot.action('admin_bc_help', async (ctx) => {
  await ctx.reply('📢 **Broadcast ပို့ရန်:**\n`/broadcast သင့်စာသား` လို့ ရိုက်ပါ။');
});

// Add Product Command
bot.command('addproduct', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const parts = ctx.message.text.split(' ').slice(1).join(' ').split('|').map(s => s.trim());
  if (parts.length < 4) return ctx.reply('Format မှားနေပါတယ်။ /addproduct id | name | price | category');
  products.push({ id: parts[0], name: parts[1], price: parts[2], category: parts[3] });
  await ctx.reply(`✅ Added: ${parts[1]}`);
});

// Delete Product Command
bot.command('delproduct', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const id = ctx.message.text.split(' ')[1];
  products = products.filter(p => p.id !== id);
  await ctx.reply(`✅ Deleted product ID: ${id}`);
});

// Admin Confirm/Reject Actions
bot.action(/^admin_confirm_(.+)$/, async (ctx) => {
  const targetId = ctx.match[1];
  try {
    await ctx.telegram.sendMessage(targetId, '✅ သင့်ငွေလွှဲမှုကို အတည်ပြုပြီးပါပြီ။ Ebook ကို ပို့ပေးလိုက်ပါတယ်။');
    if (fs.existsSync(PDF_FILE_PATH)) await ctx.telegram.sendDocument(targetId, { source: PDF_FILE_PATH });
    await ctx.telegram.sendMessage(targetId, `🎁 VIP Book Club: ${VIP_BOOK_CLUB_LINK}`);
    await ctx.reply(`User ${targetId} ကို အတည်ပြုပြီးပါပြီ။`);
  } catch (e) { ctx.reply('Error: ' + e.message); }
});

bot.action(/^admin_reject_(.+)$/, async (ctx) => {
  const targetId = ctx.match[1];
  try {
    await ctx.telegram.sendMessage(targetId, '❌ သင့်ငွေလွှဲမှု မှားယွင်းနေပါသည်။ ကျေးဇူးပြု၍ Admin (@Diary1031) ကို ဆက်သွယ်ပါ။');
    await ctx.reply(`User ${targetId} ကို Reject လုပ်ပြီးပါပြီ။`);
  } catch (e) { console.error(e); }
});

bot.command('broadcast', async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const msg = ctx.message.text.split(' ').slice(1).join(' ');
  for (const id in users) { try { await ctx.telegram.sendMessage(id, `📢 **Admin Message:**\n\n${msg}`); } catch(e){} }
  await ctx.reply('✅ Broadcast Sent.');
});

bot.launch();
console.log('Admin Bot is running...');
