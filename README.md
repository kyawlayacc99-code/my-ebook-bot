# Ebook Sales Telegram Bot

This is a Telegram bot designed to act as a sales funnel for the "7-Day Self-Respect System" ebook. It guides users through a series of messages and buttons, handles payment screenshots, and allows an admin to confirm payments and deliver the ebook.

## Features

- **Sales Funnel:** Guides users through a predefined message flow to encourage purchase.
- **Inline Keyboards:** Uses interactive buttons for a smooth user experience.
- **Payment Handling:** Instructs users on payment methods and collects payment screenshots.
- **Admin Confirmation:** Allows an administrator to confirm payments and deliver the ebook and VIP Book Club link.
- **Error Handling:** Basic error handling for robust operation.
- **Environment Variables:** Securely manages sensitive information using `.env`.

## Setup Instructions

Follow these steps to set up and run the bot:

### 1. Get your Bot Token

1. Open Telegram and search for `@BotFather`.
2. Start a chat with `@BotFather` and send the command `/newbot`.
3. Follow the instructions to choose a name and a username for your bot.
4. `@BotFather` will provide you with an **HTTP API Token**. This is your `BOT_TOKEN`.

### 2. Get your Admin ID

1. Open Telegram and search for `@userinfobot`.
2. Start a chat with `@userinfobot` and it will immediately send you your User ID. This is your `ADMIN_ID`.

### 3. Prepare the Ebook File

Ensure your ebook PDF file, named `Rebuild-Your-Self-Esteem-in-7-Days.pdf`, is in the same directory as `index.js`.

### 4. Install Node.js and npm

If you don't have Node.js and npm installed, download and install them from the official website: [https://nodejs.org/](https://nodejs.org/)

### 5. Install Dependencies

Navigate to the bot's directory in your terminal and install the required Node.js packages:

```bash
npm install
```

### 6. Configure Environment Variables

1. Create a file named `.env` in the root directory of the project (the same directory as `index.js`).
2. Copy the contents of `.env.example` into your new `.env` file.
3. Replace the placeholder values with your actual `BOT_TOKEN` and `ADMIN_ID`.

Your `.env` file should look like this (with your actual values):

```
BOT_TOKEN=8602934089:AAGRx9GDeaWlr5SmCCbjloCYmPSbyhUHs_o
ADMIN_ID=6250898892
PDF_FILE_PATH=./Rebuild-Your-Self-Esteem-in-7-Days.pdf
```

## How to Run the Bot

Once you have completed the setup, you can run the bot using the following command in your terminal from the project directory:

```bash
npm start
```

The bot will start, and you can interact with it on Telegram.

## Admin Commands

- `/confirm <user_id>`: Use this command in your chat with the bot to confirm a user's payment and send them the ebook and VIP Book Club link. Replace `<user_id>` with the actual Telegram User ID of the buyer.
