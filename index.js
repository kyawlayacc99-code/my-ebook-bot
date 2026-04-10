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
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ===== USER EVENT =====
async function recordUserEvent(userId, action) {
  await supabase.from('user_events').insert({
    user_id: userId,
    last_action: action
  });
}

// ===== SELF PING =====
setInterval(() => {
  if (APP_URL) {
    https.get(APP_URL).on('error', () => {});
  }
}, 5 * 60 * 1000);

// ===== HEALTH SERVER =====
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot alive');
}).listen(PORT);

// ===== START =====
bot.start(async (ctx) => {
  await recordUserEvent(ctx.from.id, 'start');

  await supabase.from('users').upsert({
    id: ctx.from.id,
    username: ctx.from.username
  });

  await ctx.reply(
    '📚 Welcome to Ebook Store',
    Markup.inlineKeyboard([
      [Markup.button.callback('🛍 Browse Products', 'browse')],
      [Markup.button.callback('📞 Contact Admin', 'contact')]
    ])
  );
});

// ===== BROWSE =====
bot.action('browse', async (ctx) => {
  await recordUserEvent(ctx.from.id, 'browse');

  const { data: products } = await supabase.from('products').select('*');

  if (!products || products.length === 0) {
    return ctx.reply('No products yet');
  }

  const buttons = products.map(p => [
    Markup.button.callback(p.name, `view_${p.id}`)
  ]);

  await ctx.reply('Select product:', Markup.inlineKeyboard(buttons));
});

// ===== VIEW =====
bot.action(/^view_(.+)/, async (ctx) => {
  const id = ctx.match[1];

  const { data: p } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (!p) return ctx.reply('Not found');

  const price = p.discount
    ? `🔥 ${p.discount} MMK`
    : `${p.price} MMK`;

  await ctx.reply(
    `📦 ${p.name}\n💰 ${price}\n\n${p.description || ''}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💳 Buy Now', `buy_${p.id}`)]
    ])
  );
});

// ===== BUY =====
bot.action(/^buy_(.+)/, async (ctx) => {
  const id = ctx.match[1];

  await supabase.from('orders').insert({
    user_id: ctx.from.id,
    product_id: id,
    status: 'pending'
  });

  await ctx.reply(
    '💳 Payment\n\nKBZ - 09793101410\nWave - 09976216414\n\n📸 Screenshot ပို့ပါ',
    Markup.inlineKeyboard([
      [Markup.button.callback("📸 I've Paid", 'paid')]
    ])
  );
});

// ===== PAID =====
bot.action('paid', async (ctx) => {
  await ctx.reply('📸 Screenshot ပို့ပါ');
});

// ===== SCREENSHOT =====
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo.pop();

  await ctx.telegram.sendPhoto(
    ADMIN_ID,
    photo.file_id,
    {
      caption: `Payment from ${userId}`,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Confirm', `ok_${userId}`)],
        [Markup.button.callback('❌ Reject', `no_${userId}`)]
      ])
    }
  );

  await ctx.reply('Waiting admin confirm...');
});

// ===== CONFIRM =====
bot.action(/^ok_(.+)/, async (ctx) => {
  const userId = ctx.match[1];

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  if (!order) return;

  const { data: p } = await supabase
    .from('products')
    .select('*')
    .eq('id', order.product_id)
    .single();

  if (!p) return;

  if (p.file_url) {
    await bot.telegram.sendDocument(userId, p.file_url);
  }

  await bot.telegram.sendMessage(userId, '✅ Payment confirmed!');

  await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('user_id', userId)
    .eq('status', 'pending');
});

// ===== REJECT =====
bot.action(/^no_(.+)/, async (ctx) => {
  const userId = ctx.match[1];
  await bot.telegram.sendMessage(userId, '❌ Payment failed');
});

// ===== ADMIN ADD =====
bot.command('add', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;

  await ctx.reply('Send:\nid|name|price|desc');
});

bot.on('text', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;

  if (ctx.message.text.includes('|')) {
    const [id, name, price, desc] = ctx.message.text.split('|');

    await supabase.from('products').insert({
      id,
      name,
      price: Number(price),
      description: desc
    });

    ctx.reply('✅ Added');
  }
});

bot.launch();
console.log('Bot running...');
