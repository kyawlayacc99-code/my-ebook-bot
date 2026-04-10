require(\'dotenv\').config(); const { Telegraf, Markup } = require(\'telegraf\'); const { createClient } = require(\'@supabase/supabase-js\'); const http = require(\'http\'); const https = require(\'https\');

const bot = new Telegraf(process.env.BOT_TOKEN); const ADMIN_ID = String(process.env.ADMIN_ID); const APP_URL = process.env.APP_URL; const PORT = process.env.PORT || 3000;

// Supabase Setup const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Function to record user events
async function recordUserEvent(userId, action) {
  await supabase.from("user_events").insert({ user_id: userId, last_action: action });
}

// ====== SELF PING (5 MIN) ====== setInterval(() => { if (APP_URL) { https.get(APP_URL).on(\'error\', () => {}); } }, 5 * 60 * 1000);

// health server http.createServer((req, res) => { res.writeHead(200); res.end(\'Bot alive\'); }).listen(PORT);

// ====== START ====== bot.start(async (ctx) => { 
  await recordUserEvent(ctx.from.id, \'start\');
  const { data, error } = await supabase .from(\'users\') .upsert({ id: ctx.from.id, username: ctx.from.username }) .select();

await ctx.reply( \"📚 Welcome to Ebook Store\", Markup.inlineKeyboard([ [Markup.button.callback(\"🛍 Browse Products\", \"browse\")], [Markup.button.callback(\"📞 Contact Admin\", \"contact\")] ]) ); });

// ====== BROWSE ====== bot.action(\'browse\', async (ctx) => { 
  await recordUserEvent(ctx.from.id, \'browse\');
  const { data: categories, error: catError } = await supabase.from(\'products\').select(\'category\').not(\'category\', \'is\', null).distinct();

  if (categories && categories.length > 0) {
    const categoryButtons = categories.map(cat => [
      Markup.button.callback(cat.category, `category_${cat.category}`)
    ]);
    await ctx.reply(\'Select a category:\', Markup.inlineKeyboard(categoryButtons));
  } else {
    // Fallback to showing all products if no categories
    const { data: products, error } = await supabase.from(\'products\').select(\'*\');
    if (!products || products.length === 0) {
      return ctx.reply(\'No products yet\');
    }
    const buttons = products.map(p => [
      Markup.button.callback(p.name, `view_${p.id}`)
    ]);
    await ctx.reply(\'Select product:\', Markup.inlineKeyboard(buttons));
  }
});

bot.action(/^category_(.+)/, async (ctx) => {
  const category = ctx.match[1];
  await recordUserEvent(ctx.from.id, `view_category_${category}`);
  const { data: products, error } = await supabase.from(\'products\').select(\'*\').eq(\'category\', category);

  if (!products || products.length === 0) {
    return ctx.reply(`No products in ${category} yet.`);
  }

  const buttons = products.map(p => [
    Markup.button.callback(p.name, `view_${p.id}`)
  ]);
  await ctx.reply(`Products in ${category}:`, Markup.inlineKeyboard(buttons));
});

// ====== VIEW PRODUCT ====== bot.action(/^view_(.+)/, async (ctx) => {  
  const id = ctx.match[1]; 
  await recordUserEvent(ctx.from.id, `view_${id}`);
  const { data: p, error } = await supabase.from(\'products\').select(\'*\').eq(\'id\', id).single();

if (!p) return ctx.reply(\"Not found\");

let price = p.discount ? `🔥 ${p.discount} MMK (Discount)` : `${p.price} MMK`;

await ctx.reply( `📦 ${p.name} 💰 ${price}\n\n${p.description || \"\"}`,   Markup.inlineKeyboard([   [Markup.button.callback(\"💳 Buy Now\", `buy_${p.id}`)] ]) ); 

  // Basic Recommendation System
  const { data: otherProducts, error: otherProductsError } = await supabase
    .from(\"products\")
    .select(\"id, name\")
    .neq(\"id\", id) // Exclude the current product
    .order(\"id\", { ascending: true }) // Order by ID to enable consistent random selection
    .limit(3); // Get a few more than needed to ensure randomness after filtering

  if (otherProducts && otherProducts.length > 0) {
    // Shuffle and pick 2 random products
    const shuffled = otherProducts.sort(() => 0.5 - Math.random());
    const recommended = shuffled.slice(0, 2);

    if (recommended.length > 0) {
      const recommendButtons = recommended.map(rp => [
        Markup.button.callback(rp.name, `view_${rp.id}`)
      ]);
      await ctx.reply(\"You might also like:\", Markup.inlineKeyboard(recommendButtons));
    }
  }
});

// ====== BUY ====== bot.action(/^buy_(.+)/, async (ctx) => { 
  const id = ctx.match[1]; 
  await recordUserEvent(ctx.from.id, `buy_${id}`);
  const { data: p } = await supabase.from(\'products\').select(\'*\').eq(\'id\', id).single();

  const { data: existingPendingOrder } = await supabase.from(\'orders\').select(\'*\').eq(\'user_id\', ctx.from.id).eq(\'product_id\', id).eq(\'status\', \'pending\').single();
  if (existingPendingOrder) {
    return ctx.reply(\'You already have a pending order for this product. Please complete it first.\');
  }

  await supabase.from(\'orders\').insert({ user_id: ctx.from.id, product_id: id, status: \'pending\' });await ctx.reply( `💳 Payment\n\nKBZ - 09793101410 Wave - 09976216414 AYA - 09793101410\n\n📸 Screenshot ပို့ပါ`, Markup.inlineKeyboard([ [Markup.button.callback(\"📸 I\'ve Paid\", \"paid\")] ]) ); });

bot.action(\'paid\', async (ctx) => {
  const { data: pendingOrder } = await supabase.from(\'orders\').select(\'*\').eq(\'user_id\', ctx.from.id).eq(\'status\', \'pending\').single();
  if (!pendingOrder) {
    return ctx.reply(\'You don\'t have any pending orders to confirm payment for.\');
  }
  await ctx.reply(\"📸 Screenshot ပို့ပါ\");
});

// Reminder system (runs every hour)
setInterval(async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: browseEvents, error } = await supabase
    .from("user_events")
    .select("user_id")
    .eq("last_action", "browse")
    .gte("timestamp", twentyFourHoursAgo);

  if (browseEvents && browseEvents.length > 0) {
    for (const event of browseEvents) {
      const { data: orders, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", event.user_id)
        .gte("created_at", twentyFourHoursAgo);

      if (!orders || orders.length === 0) {
        // User browsed but didn\'t buy in the last 24 hours
        await bot.telegram.sendMessage(
          event.user_id,
          "Hey there! Still thinking about that ebook? Don\'t miss out!"
        );
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour


// ====== RECEIVE SCREENSHOT ====== bot.on(\'photo\', async (ctx) => { const userId = ctx.from.id; const photo = ctx.message.photo.pop();

await ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, { caption: `Payment from ${userId}`, ...Markup.inlineKeyboard([ [Markup.button.callback(\"✅ Confirm\", `ok_${userId}`)], [Markup.button.callback(\"❌ Reject\", `no_${userId}`)] ]) });

await ctx.reply(\"Waiting admin confirm...\"); });

// ====== ADMIN CONFIRM ====== bot.action(/^ok_(.+)/, async (ctx) => { const userId = ctx.match[1]; const { data: order } = await supabase.from(\'orders\').select(\'*\').eq(\'user_id\', userId).eq(\'status\', \'pending\').single();

if (!order) return;

const { data: p } = await supabase.from(\'products\').select(\'*\').eq(\'id\', order.product_id).single();\nif (!p) return;\nconst links = p.channels.map(c => `👉 ${c}`).join("\\n");

if (p.file_url) { await bot.telegram.sendDocument(userId, p.file_url, { caption: `✅ Confirmed! Here is your ebook: ${p.name}` }); }\nawait bot.telegram.sendMessage(userId, `✅ Confirmed!\n\n📥 Join: ${links}`);
await bot.telegram.sendMessage(userId, "How would you rate your purchase? (1-5)", Markup.inlineKeyboard([
  [Markup.button.callback("1 ⭐", `review_${order.product_id}_1`)],
  [Markup.button.callback("2 ⭐", `review_${order.product_id}_2`)],
  [Markup.button.callback("3 ⭐", `review_${order.product_id}_3`)],
  [Markup.button.callback("4 ⭐", `review_${order.product_id}_4`)],
  [Markup.button.callback("5 ⭐", `review_${order.product_id}_5`)]
]));

await supabase.from(\'orders\').update({ status: \'paid\' }).eq(\'user_id\', userId).eq(\'status\', \'pending\'); });

// ====== REJECT ====== bot.action(/^no_(.+)/, async (ctx) => { const userId = ctx.match[1]; await bot.telegram.sendMessage(userId, \"❌ Payment failed\"); });

// ====== REVIEW SYSTEM ====== bot.action(/^review_(.+)_([1-5])$/, async (ctx) => {
  const [, productId, rating] = ctx.match;
  await recordUserEvent(ctx.from.id, `review_${productId}_${rating}`);
  await supabase.from("reviews").insert({ user_id: ctx.from.id, product_id: productId, rating: parseInt(rating) });
  await ctx.reply("Thank you for your feedback!");
});

// ====== ADMIN STATS ====== bot.command("stats", async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;

  const { count: totalOrders } = await supabase.from("orders").select("*", { count: "exact" });
  const { count: paidOrders } = await supabase.from("orders").select("*", { count: "exact" }).eq("status", "paid");
  const { count: pendingOrders } = await supabase.from("orders").select("*", { count: "exact" }).eq("status", "pending");

  await ctx.reply(
    `📊 *Order Statistics*\n\n` +
    `Total Orders: ${totalOrders || 0}\n` +
    `Paid Orders: ${paidOrders || 0}\n` +
    `Pending Orders: ${pendingOrders || 0}`,
    { parse_mode: "Markdown" }
  );
});

// ====== ADD PRODUCT ====== bot.command(\'add\', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  await ctx.reply(\"Send:\\nid|name|price|discount|desc|channel1,channel2\");
});

bot.on(\'text\', async (ctx) => {
  // Support Chat Relay: If not admin and not a command, forward to admin
  if (String(ctx.from.id) !== ADMIN_ID && !ctx.message.text.startsWith(\\\'/\\\')) {
    await bot.telegram.sendMessage(ADMIN_ID, `Message from user ${ctx.from.id} (${ctx.from.username || \'N/A\'}):\\n\\n${ctx.message.text}`);
    await ctx.reply(\'Your message has been forwarded to the admin. We will get back to you shortly.\');
    return;
  }

  // Admin command logic for adding products
  if (String(ctx.from.id) === ADMIN_ID && ctx.message.text.includes(\'|\')) {
    const [id, name, price, discount, desc, channels] = ctx.message.text.split(\'|\');

    await supabase.from(\'products\').insert({ id, name, price: Number(price), discount: discount ? Number(discount) : null, description: desc, channels: channels.split(\'\\\') });

    ctx.reply(\'✅ Added to Database\');
    return;
  }
});

// ====== ANALYTICS COMMAND ====== bot.command("top", async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;

  const { data: topProducts, error } = await supabase
    .from("orders")
    .select("product_id, count(product_id)")
    .eq("status", "paid")
    .group("product_id")
    .order("count", { ascending: false })
    .limit(5);

  if (!topProducts || topProducts.length === 0) {
    return ctx.reply("No purchased products yet.");
  }

  let message = "🏆 *Top 5 Purchased Products*\n\n";
  for (const item of topProducts) {
    const { data: product } = await supabase.from("products").select("name").eq("id", item.product_id).single();
    message += `• ${product ? product.name : item.product_id} (${item.count} sales)\n`;
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
});

bot.launch();
console.log(\"Bot running with Supabase...\");
