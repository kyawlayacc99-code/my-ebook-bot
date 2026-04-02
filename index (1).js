require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;
const PDF_FILE_PATH = process.env.PDF_FILE_PATH;
const VIP_BOOK_CLUB_LINK = 'https://t.me/+eboPYDMzR7VlMzU1';

// In-memory storage for users and payment confirmations
const users = {}; // { userId: { username, paymentConfirmed: false, paymentScreenshotFileId: null } }

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  if (!users[userId]) {
    users[userId] = { username: username, paymentConfirmed: false };
    console.log(`New user started bot: ${username} (${userId})`);
  }

  await ctx.reply(
    '📘 7-Day Self-Respect System\n\nSelf-esteem ကို ပြန်တည်ဆောက်ချင်လား?\n\nဒီ system က:\n✔ 7 days execution plan\n✔ Daily discipline system\n✔ Self-trust rebuild method\n\n👉 ၇ ရက်အတွင်း \'ငါပြောရင် ငါလုပ်နိုင်တယ်\' ဆိုတဲ့ feeling ပြန်ရမယ်',
    Markup.inlineKeyboard([
      Markup.button.callback('Continue', 'continue_funnel')
    ])
  );
});

bot.action('continue_funnel', async (ctx) => {
  await ctx.editMessageText(
    'မင်း self-esteem ကျနေတာဟာ\n\n❌ ရုပ်ဆိုးလို့ မဟုတ်ဘူး\n❌ ပိုက်ဆံမရှိလို့ မဟုတ်ဘူး\n\n👉 ကိုယ့်ကိုယ်ကိုယ် ပေးထားတဲ့ ကတိတွေကို\nခဏခဏ ဖောက်ဖျက်နေလို့ပဲ ဖြစ်ပါတယ်',
    Markup.inlineKeyboard([
      Markup.button.callback('See Solution', 'see_solution')
    ])
  );
});

bot.action('see_solution', async (ctx) => {
  await ctx.editMessageText(
    'ဒီ system ထဲမှာ\n\nDay 1-3 → Discipline build\nDay 4-5 → No excuses training\nDay 6-7 → Momentum build\n\n👉 Simple tasks only\n👉 Real execution\n\n📌 Goal:\nSelf-trust → Self-esteem → Confidence',
    Markup.inlineKeyboard([
      Markup.button.callback('Get Access', 'get_access')
    ])
  );
});

bot.action('get_access', async (ctx) => {
  await ctx.editMessageText(
    '💰 Price – 20,000 ks\n\n🎁 Bonus:\nVIP Book Club (Telegram)\n\n🔁 100% Refund Guarantee\n7 days try လုပ်ပြီး မပြောင်းလဲရင်\ndirect message ပို့ပြီး refund တောင်းနိုင်ပါတယ်',
    Markup.inlineKeyboard([
      Markup.button.callback('Buy Now', 'buy_now')
    ])
  );
});

bot.action('buy_now', async (ctx) => {
  await ctx.reply(
    '💳 Payment Methods:\n\nKpay – 09793101410 (kyaw chit koko)\nWave – 09976216414(kyaw chit koko)\n\n👉 Payment screenshot ပို့ပြီး Confirm button နှိပ်ပါ',
    Markup.inlineKeyboard([
      Markup.button.callback('I\'ve Paid', 'i_have_paid')
    ])
  );
});

bot.action('i_have_paid', async (ctx) => {
  await ctx.reply('📸 Please send your payment screenshot.');
});

// Handle image messages (payment screenshots)
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  if (!users[userId]) {
    users[userId] = { username: username, paymentConfirmed: false };
  }

  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Get the largest photo
  const fileId = photo.file_id;

  users[userId].paymentScreenshotFileId = fileId;

  // Forward the image to ADMIN_ID
  try {
    await ctx.telegram.sendPhoto(ADMIN_ID, fileId, {
      caption: `Payment screenshot from ${username} (ID: ${userId}).\nTo confirm, use: /confirm ${userId}`,
    });
    await ctx.reply('✅ Payment received. Admin will confirm shortly.');
    console.log(`Payment screenshot received from ${username} (${userId})`);
  } catch (error) {
    console.error('Error forwarding photo to admin:', error);
    await ctx.reply('An error occurred while processing your payment. Please try again or contact support.');
  }
});

// Admin confirmation command
bot.command('confirm', async (ctx) => {
  const adminId = ctx.from.id;
  if (String(adminId) !== String(ADMIN_ID)) {
    return ctx.reply('You are not authorized to use this command.');
  }

  const args = ctx.message.text.split(' ');
  const targetUserId = args[1];

  if (!targetUserId) {
    return ctx.reply('Usage: /confirm <user_id>');
  }

  if (!users[targetUserId]) {
    return ctx.reply(`User ${targetUserId} not found or has not interacted with the bot.`);
  }

  if (users[targetUserId].paymentConfirmed) {
    return ctx.reply(`Payment for user ${targetUserId} has already been confirmed.`);
  }

  try {
    // Send confirmation to the user
    await ctx.telegram.sendMessage(targetUserId, '✅ Payment Confirmed');

    // Send PDF file to the user
    await ctx.telegram.sendDocument(targetUserId, { source: PDF_FILE_PATH }, { caption: '📘 Your ebook:' });

    // Send VIP Book Club link
    await ctx.telegram.sendMessage(
      targetUserId,
      `🎁 VIP Book Club:\n[${VIP_BOOK_CLUB_LINK}]\n\n👉 Join request ပို့ပြီး admin approve စောင့်ပါ`
    );

    users[targetUserId].paymentConfirmed = true;
    console.log(`Payment confirmed for user ${targetUserId}`);
    await ctx.reply(`Successfully confirmed payment for user ${targetUserId}.`);
  } catch (error) {
    console.error(`Error confirming payment for user ${targetUserId}:`, error);
    await ctx.reply(`Failed to confirm payment for user ${targetUserId}. Error: ${error.message}`);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

bot.launch();

console.log('Bot started');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
