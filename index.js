require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const https = require('https');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = String(process.env.ADMIN_ID);
const APP_URL = process.env.APP_URL;
const PORT = process.env.PORT || 3000;

// Supabase Setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ====== SELF PING (5 MIN) ======
setInterval(() => {
  if (APP_URL) {
    https.get(APP_URL).on('error', () => {});
  }
}, 5 * 60 * 1000);

// health server
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot alive');
}).listen(PORT);

// ====== START ======
bot.start(async (ctx) => {
  const { data, error } = await supabase
    .from('users')
    .upsert({ id: ctx.from.id, username: ctx.from.username })
    .select();

  await ctx.reply(
    "📚 Welcome to Ebook Store",
    Markup.inlineKeyboard([
      [Markup.button.callback("🛍 Browse Products", "browse")],
      [Markup.button.callback("📞 Contact Admin", "contact")]
    ])
  );
});

// ====== BROWSE ======
bot.action('browse', async (ctx) => {
  const { data: products, error } = await supabase.from('products').select('*');
  
  if (!products || products.length === 0) {
    return ctx.reply("No products yet");
  }

  const buttons = products.map(p => [
    Markup.button.callback(p.name, `view_${p.id}`)
  ]);

  await ctx.reply("Select product:", Markup.inlineKeyboard(buttons));
});

// ====== VIEW PRODUCT ======
bot.action(/^view_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const { data: p, error } = await supabase.from('products').select('*').eq('id', id).single();

  if (!p) return ctx.reply("Not found");

  let price = p.discount
    ? `🔥 ${p.discount} MMK (Discount)`
    : `${p.price} MMK`;

  await ctx.reply(
`📦 ${p.name}
💰 ${price}

${p.description || ""}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("💳 Buy Now", `buy_${p.id}`)]
    ])
  );
});

// ====== BUY ======
bot.action(/^buy_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single();

  await supabase.from('pending_orders').upsert({ 
    user_id: ctx.from.id, 
    product_id: id,
    product_data: p
  });

  await ctx.reply(
`💳 Payment

KBZ - 09793101410
Wave - 09976216414
AYA - 09793101410

📸 Screenshot ပို့ပါ`,
    Markup.inlineKeyboard([
      [Markup.button.callback("📸 I've Paid", "paid")]
    ])
  );
});

bot.action('paid', async (ctx) => {
  await ctx.reply("📸 Screenshot ပို့ပါ");
});

// ====== RECEIVE SCREENSHOT ======
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo.pop();

  await ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
    caption: `Payment from ${userId}`,
    ...Markup.inlineKeyboard([
      [Markup.button.callback("✅ Confirm", `ok_${userId}`)],
      [Markup.button.callback("❌ Reject", `no_${userId}`)]
    ])
  });

  await ctx.reply("Waiting admin confirm...");
});

// ====== ADMIN CONFIRM ======
bot.action(/^ok_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  const { data: order } = await supabase.from('pending_orders').select('*').eq('user_id', userId).single();

  if (!order) return;

  const p = order.product_data;
  const links = p.channels.map(c => `👉 ${c}`).join("\n");

  await bot.telegram.sendMessage(userId,
`✅ Confirmed!

📥 Join:
${links}`);

  await supabase.from('pending_orders').delete().eq('user_id', userId);
});

// ====== REJECT ======
bot.action(/^no_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await bot.telegram.sendMessage(userId, "❌ Payment failed");
});

// ====== ADD PRODUCT ======
bot.command('add', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  await ctx.reply("Send:\nid|name|price|discount|desc|channel1,channel2");
});

bot.on('text', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  if (!ctx.message.text.includes('|')) return;

  const [id, name, price, discount, desc, channels] = ctx.message.text.split('|');

  await supabase.from('products').insert({
    id,
    name,
    price: Number(price),
    discount: discount ? Number(discount) : null,
    description: desc,
    channels: channels.split(',')
  });

  ctx.reply("✅ Added to Database");
});

bot.launch();
console.log("Bot running with Supabase...");
