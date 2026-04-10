require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = String(process.env.ADMIN_ID);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ===== START =====
bot.start(async (ctx) => {
  await supabase.from('users').upsert({
    id: ctx.from.id,
    username: ctx.from.username
  });

  ctx.reply('📚 Welcome to Ebook Store', Markup.inlineKeyboard([
    [Markup.button.callback('🛍 Browse', 'browse')],
    [Markup.button.callback('🔥 Best Offer', 'browse')]
  ]));
});

// ===== BROWSE =====
bot.action('browse', async (ctx) => {
  const { data } = await supabase.from('products').select('category');

  const categories = [...new Set(data.map(p => p.category).filter(Boolean))];

  if (categories.length === 0) {
    const { data: products } = await supabase.from('products').select('*');
    return showProducts(ctx, products);
  }

  const buttons = categories.map(c => [Markup.button.callback(c, `cat_${c}`)]);
  ctx.reply('📂 Categories:', Markup.inlineKeyboard(buttons));
});

// ===== CATEGORY =====
bot.action(/^cat_(.+)/, async (ctx) => {
  const cat = ctx.match[1];
  const { data } = await supabase.from('products').select('*').eq('category', cat);
  showProducts(ctx, data);
});

// ===== SHOW PRODUCTS =====
function showProducts(ctx, products) {
  if (!products || products.length === 0) return ctx.reply('No products');

  const buttons = products.map(p => [
    Markup.button.callback(`${p.name} (${p.price})`, `view_${p.id}`)
  ]);

  ctx.reply('📦 Products:', Markup.inlineKeyboard(buttons));
}

// ===== VIEW =====
bot.action(/^view_(.+)/, async (ctx) => {
  const id = ctx.match[1];

  const { data: p } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (!p) return ctx.reply('Not found');

  const price = p.discount ? `🔥 ${p.discount}` : p.price;

  if (p.image_url) {
    await ctx.replyWithPhoto(p.image_url);
  }

  ctx.reply(
    `📦 ${p.name}\n💰 ${price} MMK\n\n${p.description}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💳 Buy', `buy_${p.id}`)]
    ])
  );
});

// ===== BUY =====
bot.action(/^buy_(.+)/, async (ctx) => {
  const id = ctx.match[1];

  const { data: exist } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', ctx.from.id)
    .eq('product_id', id)
    .eq('status', 'pending')
    .single();

  if (exist) return ctx.reply('⚠️ You already have pending order');

  await supabase.from('orders').insert({
    user_id: ctx.from.id,
    product_id: id,
    status: 'pending'
  });

  ctx.reply(
    '💳 Payment\nKBZ/Wave\n\n📸 Send screenshot',
    Markup.inlineKeyboard([
      [Markup.button.callback("I've Paid", 'paid')]
    ])
  );
});

// ===== PAID =====
bot.action('paid', (ctx) => ctx.reply('📸 Send screenshot now'));

// ===== SCREENSHOT =====
bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo.pop();

  await ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
    caption: `Payment from ${ctx.from.id}`,
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirm', `ok_${ctx.from.id}`)],
      [Markup.button.callback('❌ Reject', `no_${ctx.from.id}`)]
    ])
  });

  ctx.reply('⏳ Waiting admin confirm...');
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

  if (p.channels && p.channels.length > 0) {
    const links = p.channels.join('\n');
    await bot.telegram.sendMessage(userId, `🔗 Join:\n${links}`);
  }

  await bot.telegram.sendMessage(userId, '✅ Payment confirmed!');

  await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('user_id', userId)
    .eq('status', 'pending');
});

// ===== REJECT =====
bot.action(/^no_(.+)/, (ctx) => {
  bot.telegram.sendMessage(ctx.match[1], '❌ Payment rejected');
});

// ===== ADD PRODUCT =====
bot.command('add', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  ctx.reply('Send:\nid|name|price|desc|file_url|channels|category|image_url');
});

// ===== TEXT HANDLER (ONLY ONE) =====
bot.on('text', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;

  const text = ctx.message.text;

  // ADD PRODUCT
  if (text.includes('|')) {
    try {
      const [id, name, price, desc, file_url, channels, category, image_url] =
        text.split('|');

      await supabase.from('products').insert({
        id,
        name,
        price: Number(price),
        description: desc,
        file_url,
        channels: channels ? channels.split(',') : [],
        category,
        image_url
      });

      return ctx.reply('✅ Product added');
    } catch {
      return ctx.reply('❌ Format error');
    }
  }

  // BROADCAST
  if (text.startsWith('BROADCAST:')) {
    const msg = text.replace('BROADCAST:', '');

    const { data: users } = await supabase.from('users').select('id');

    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u.id, msg);
      } catch {}
    }

    return ctx.reply('📢 Broadcast done');
  }
});

bot.launch();
console.log('🚀 Bot live');
