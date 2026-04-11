// ============================================
// TELEGRAM EBOOK BOT - PRODUCTION READY
// Stack: Node.js + Telegraf + Supabase
// ============================================

const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// --- Global Error Handlers (MUST be at top) ---
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
  // Don't exit — keep the bot alive
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit — keep the bot alive
});

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY || !ADMIN_ID) {
  console.error('❌ Missing environment variables! Check BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY, ADMIN_ID');
  process.exit(1);
}

const ADMIN_CHAT_ID = Number(ADMIN_ID);

// --- Initialize Bot & Supabase ---
const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Helper: Safe Supabase Query ---
async function safeQuery(queryFn) {
  try {
    const result = await queryFn();
    if (result.error) {
      console.error('⚠️ Supabase query error:', result.error.message);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  } catch (err) {
    console.error('⚠️ Supabase exception:', err.message);
    return { data: null, error: err };
  }
}

// --- Helper: Safe Reply ---
async function safeReply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
  } catch (err) {
    console.error('⚠️ Reply failed:', err.message);
  }
}

async function safeAnswerCb(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch (err) {
    // Ignore — callback might have expired
  }
}

// --- User State Management (in-memory) ---
// For tracking which user is in "waiting for screenshot" state
const userState = new Map();
// userState format: { action: 'awaiting_screenshot', productId: '...' }

// ============================================
// /start COMMAND
// ============================================
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'User';

    // Upsert user into database
    await safeQuery(() =>
      supabase.from('users').upsert(
        {
          telegram_id: userId,
          username: username,
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_id' }
      )
    );

    userState.delete(userId); // Reset state

    await safeReply(
      ctx,
      `📚 <b>မင်္ဂလာပါ ${username}!</b>\\n\\nEbook Store မှ ကြိုဆိုပါတယ်။\\n\\nစာအုပ်များကို ကြည့်ရှုရန် အောက်က ခလုတ်ကို နှိပ်ပါ။`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📖 စာအုပ်များ ကြည့်ရန်', 'browse_products')],
        [Markup.button.callback('📂 Category အလိုက် ကြည့်ရန်', 'browse_categories')],
      ])
    );
  } catch (err) {
    console.error('❌ /start error:', err.message);
    await safeReply(ctx, '⚠️ တစ်ခုခု မှားနေပါတယ်။ နောက်တစ်ခါ ထပ်ကြိုးစားပါ။');
  }
});

// ============================================
// BROWSE ALL PRODUCTS
// ============================================
bot.action('browse_products', async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    const { data: products, error } = await safeQuery(() =>
      supabase.from('products').select('*').order('created_at', { ascending: false })
    );

    if (error || !products || products.length === 0) {
      return await safeReply(ctx, '📭 လောလောဆယ် စာအုပ်မရှိသေးပါ။');
    }

    const buttons = products.map((p) => [
      Markup.button.callback(`📕 ${p.name} — ${p.price} Ks`, `product_${p.id}`),
    ]);

    buttons.push([Markup.button.callback('🔙 နောက်သို့', 'go_back_home')]);

    await safeReply(ctx, '📚 <b>ရရှိနိုင်သော စာအုပ်များ</b>', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('❌ browse_products error:', err.message);
    await safeReply(ctx, '⚠️ စာအုပ်များ ဖော်ပြ၍ မရပါ။');
  }
});

// ============================================
// BROWSE BY CATEGORY
// ============================================
bot.action('browse_categories', async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    const { data: products, error } = await safeQuery(() =>
      supabase.from('products').select('category')
    );

    if (error || !products || products.length === 0) {
      return await safeReply(ctx, '📭 Category မရှိသေးပါ။');
    }

    // Get unique categories
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

    if (categories.length === 0) {
      return await safeReply(ctx, '📭 Category မရှိသေးပါ။');
    }

    const buttons = categories.map((cat) => [
      Markup.button.callback(`📂 ${cat}`, `category_${cat}`),
    ]);
    buttons.push([Markup.button.callback('🔙 နောက်သို့', 'go_back_home')]);

    await safeReply(ctx, '📂 <b>Category ရွေးပါ</b>', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('❌ browse_categories error:', err.message);
    await safeReply(ctx, '⚠️ Category များ ဖော်ပြ၍ မရပါ။');
  }
});

// ============================================
// PRODUCTS BY CATEGORY
// ============================================
bot.action(/^category_(.+)$/, async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    const category = ctx.match[1];

    const { data: products, error } = await safeQuery(() =>
      supabase.from('products').select('*').eq('category', category)
    );

    if (error || !products || products.length === 0) {
      return await safeReply(ctx, `📭 "${category}" category ထဲမှာ စာအုပ်မရှိပါ။`);
    }

    const buttons = products.map((p) => [
      Markup.button.callback(`📕 ${p.name} — ${p.price} Ks`, `product_${p.id}`),
    ]);
    buttons.push([Markup.button.callback('🔙 Category များ', 'browse_categories')]);

    await safeReply(
      ctx,
      `📂 <b>${category}</b> - စာအုပ်များ`,
      Markup.inlineKeyboard(buttons)
    );
  } catch (err) {
    console.error('❌ category filter error:', err.message);
    await safeReply(ctx, '⚠️ တစ်ခုခု မှားနေပါတယ်။');
  }
});

// ============================================
// VIEW PRODUCT DETAIL
// ============================================
bot.action(/^product_(.+)$/, async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    const productId = ctx.match[1];

    // Use .maybeSingle() instead of .single() to prevent crash
    const { data: product, error } = await safeQuery(() =>
      supabase.from('products').select('*').eq('id', productId).maybeSingle()
    );

    if (error || !product) {
      return await safeReply(ctx, '⚠️ ဒီစာအုပ်ကို ရှာမတွေ့ပါ။');
    }

    const caption =
      `📕 <b>${product.name}</b>\\n\\n` +
      `💰 စျေးနှုန်း: <b>${product.price} Ks</b>\\n\\n` +
      `📝 ${product.description || 'ဖော်ပြချက် မရှိပါ။'}`;

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback('🛒 ဝယ်မည်', `buy_${product.id}`)],
      [Markup.button.callback('🔙 စာအုပ်များ', 'browse_products')],
    ]);

    // Try to send with image
    if (product.image_url) {
      try {
        await ctx.replyWithPhoto(product.image_url, {
          caption: caption,
          parse_mode: 'HTML',
          ...buttons,
        });
        return;
      } catch (imgErr) {
        console.error('⚠️ Image send failed, sending text only:', imgErr.message);
      }
    }

    // Fallback: text only
    await safeReply(ctx, caption, buttons);
  } catch (err) {
    console.error('❌ product detail error:', err.message);
    await safeReply(ctx, '⚠️ စာအုပ်အချက်အလက် ဖော်ပြ၍ မရပါ။');
  }
});

// ============================================
// BUY PRODUCT — Ask for Screenshot
// ============================================
bot.action(/^buy_(.+)$/, async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;

    // Verify product exists
    const { data: product, error } = await safeQuery(() =>
      supabase.from('products').select('id, name, price').eq('id', productId).maybeSingle()
    );

    if (error || !product) {
      return await safeReply(ctx, '⚠️ ဒီစာအုပ်ကို ရှာမတွေ့ပါ။');
    }

    // Set user state to awaiting screenshot
    userState.set(userId, {
      action: 'awaiting_screenshot',
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
    });

    await safeReply(
      ctx,
      `🛒 <b>${product.name}</b> ဝယ်ယူရန်\\n\\n` +
        `💰 စျေးနှုန်း: <b>${product.price} Ks</b>\\n\\n` +
        `📸 ငွေလွှဲပြီးကြောင်း Screenshot ကို ဓာတ်ပုံအနေနဲ့ ပို့ပေးပါ။\\n\\n` +
        `❌ ပယ်ဖျက်ရန် /cancel နှိပ်ပါ။`
    );
  } catch (err) {
    console.error('❌ buy action error:', err.message);
    await safeReply(ctx, '⚠️ တစ်ခုခု မှားနေပါတယ်။');
  }
});

// ============================================
// GO BACK HOME
// ============================================
bot.action('go_back_home', async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    userState.delete(ctx.from.id);
    await safeReply(
      ctx,
      '🏠 <b>ပင်မစာမျက်နှာ</b>',
      Markup.inlineKeyboard([
        [Markup.button.callback('📖 စာအုပ်များ ကြည့်ရန်', 'browse_products')],
        [Markup.button.callback('📂 Category အလိုက် ကြည့်ရန်', 'browse_categories')],
      ])
    );
  } catch (err) {
    console.error('❌ go_back error:', err.message);
  }
});

// ============================================
// CANCEL
// ============================================
bot.command('cancel', async (ctx) => {
  try {
    userState.delete(ctx.from.id);
    await safeReply(ctx, '❌ ပယ်ဖျက်လိုက်ပါပြီ။ /start နှိပ်ပြီး ပြန်စပါ။');
  } catch (err) {
    console.error('❌ cancel error:', err.message);
  }
});

// ============================================
// ADMIN: CONFIRM ORDER
// ============================================
bot.action(/^confirm_(.+)_(.+)$/, async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    if (ctx.from.id !== ADMIN_CHAT_ID) return;

    const orderId = ctx.match[1];
    const recipientId = Number(ctx.match[2]);

    // Get order
    const { data: order, error: orderErr } = await safeQuery(() =>
      supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    );

    if (orderErr || !order) {
      return await safeReply(ctx, '⚠️ Order ရှာမတွေ့ပါ။');
    }

    // Get product
    const { data: product, error: prodErr } = await safeQuery(() =>
      supabase.from('products').select('*').eq('id', order.product_id).maybeSingle()
    );

    if (prodErr || !product) {
      return await safeReply(ctx, '⚠️ Product ရှာမတွေ့ပါ။');
    }

    // Update order status
    await safeQuery(() =>
      supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId)
    );

    // Send PDF file to user
    if (product.file_url) {
      try {
        await ctx.telegram.sendDocument(recipientId, product.file_url, {
          caption: `✅ <b>${product.name}</b> ဝယ်ယူမှု အတည်ပြုပြီးပါပြီ!\\n\\n📕 သင့်စာအုပ်ဖြစ်ပါတယ်။`,
          parse_mode: 'HTML',
        });
      } catch (fileErr) {
        console.error('⚠️ Failed to send file:', fileErr.message);
        await ctx.telegram.sendMessage(
          recipientId,
          `✅ <b>${product.name}</b> အတည်ပြုပြီးပါပြီ!\\n\\n📎 File link: ${product.file_url}`,
          { parse_mode: 'HTML' }
        );
      }
    }

    // Send channel links if available
    if (product.channels) {
      try {
        let channels = product.channels;
        if (typeof channels === 'string') {
          channels = JSON.parse(channels);
        }
        if (Array.isArray(channels) && channels.length > 0) {
          const channelLinks = channels.map((ch) => `🔗 ${ch}`).join('\\n');
          await ctx.telegram.sendMessage(
            recipientId,
            `📢 <b>Channel Links:</b>\\n\\n${channelLinks}`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (chErr) {
        console.error('⚠️ Channel parse/send error:', chErr.message);
      }
    }

    // Notify admin
    await safeReply(ctx, `✅ Order #${orderId} အတည်ပြုပြီးပါပြီ။ User ထံ ပို့ပြီးပါပြီ။`);
  } catch (err) {
    console.error('❌ confirm order error:', err.message);
    await safeReply(ctx, '⚠️ အတည်ပြုရာတွင် အမှားဖြစ်ပါတယ်။');
  }
});

// ============================================
// ADMIN: REJECT ORDER
// ============================================
bot.action(/^reject_(.+)_(.+)$/, async (ctx) => {
  await safeAnswerCb(ctx);
  try {
    if (ctx.from.id !== ADMIN_CHAT_ID) return;

    const orderId = ctx.match[1];
    const recipientId = Number(ctx.match[2]);

    // Update order status
    await safeQuery(() =>
      supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId)
    );

    // Notify user
    try {
      await ctx.telegram.sendMessage(
        recipientId,
        '❌ သင့်ငွေလွှဲမှုကို ပယ်ချလိုက်ပါတယ်။ ပြန်လည်စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။',
        { parse_mode: 'HTML' }
      );
    } catch (notifyErr) {
      console.error('⚠️ Failed to notify user:', notifyErr.message);
    }

    await safeReply(ctx, `❌ Order #${orderId} ပယ်ချလိုက်ပါပြီ။`);
  } catch (err) {
    console.error('❌ reject order error:', err.message);
    await safeReply(ctx, '⚠️ ပယ်ချရာတွင် အမှားဖြစ်ပါတယ်။');
  }
});

// ============================================
// PHOTO HANDLER — Payment Screenshot
// ============================================
bot.on('photo', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const state = userState.get(userId);

    // Check if user is in awaiting_screenshot state
    if (!state || state.action !== 'awaiting_screenshot') {
      return await safeReply(ctx, '📷 ဓာတ်ပုံကို ဘာအတွက် ပို့တာလဲ? စာအုပ်ဝယ်ရန် /start နှိပ်ပါ။');
    }

    const photo = ctx.message.photo;
    const fileId = photo[photo.length - 1].file_id; // Highest resolution

    // Create order in database
    const { data: order, error: orderErr } = await safeQuery(() =>
      supabase
        .from('orders')
        .insert({
          telegram_id: userId,
          username: ctx.from.username || ctx.from.first_name || 'Unknown',
          product_id: state.productId,
          product_name: state.productName,
          screenshot_file_id: fileId,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle()
    );

    if (orderErr || !order) {
      console.error('❌ Order creation failed:', orderErr);
      return await safeReply(ctx, '⚠️ Order တင်၍ မရပါ။ ထပ်ကြိုးစားပါ။');
    }

    // Clear user state
    userState.delete(userId);

    // Notify user
    await safeReply(
      ctx,
      `✅ Screenshot လက်ခံရရှိပါပြီ!\\n\\n` +
        `📕 စာအုပ်: <b>${state.productName}</b>\\n` +
        `🆔 Order: #${order.id}\\n\\n` +
        `⏳ Admin စစ်ဆေးပြီး အတည်ပြုပေးပါမယ်။ ခဏစောင့်ပါ။`
    );

    // Send to Admin
    try {
      await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, fileId, {
        caption:
          `🛒 <b>Order အသစ်!</b>\\n\\n` +
          `🆔 Order: #${order.id}\\n` +
          `👤 User: @${ctx.from.username || ctx.from.first_name || 'N/A'} (${userId})\\n` +
          `📕 Product: ${state.productName}\\n` +
          `💰 Price: ${state.productPrice} Ks`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Confirm', `confirm_${order.id}_${userId}`),
            Markup.button.callback('❌ Reject', `reject_${order.id}_${userId}`),
          ],
        ]),
      });
    } catch (adminErr) {
      console.error('❌ Failed to notify admin:', adminErr.message);
    }
  } catch (err) {
    console.error('❌ photo handler error:', err.message);
    await safeReply(ctx, '⚠️ Screenshot တင်၍ မရပါ။ ထပ်ကြိုးစားပါ။');
  }
});

// ============================================
// SINGLE TEXT HANDLER — Admin Commands + Fallback
// (Only ONE bot.on('text') to avoid duplicates!)
// ============================================
bot.
