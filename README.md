# Gosha

Gosha is a Telegram bot that generates crude meme-style captions for uploaded images. It uses DeepSeek V4.1 Flash via the OpenAI-compatible SDK, Telegram Bot API, and Puppeteer/Sharp-based image processing to react to screenshots and photos with short, chaotic, internet-style responses.

This DeepSeek edition is adapted for small VPS instances with limited CPU and RAM, using sequential meme processing to limit peak resource usage.

## Features

- accepts image messages in Telegram
- generates a caption in Russian, Ukrainian, or English
- describes the image to help produce more context-aware captions
- caches generated captions by image hash in the `captions/` directory
- supports multiple generation strategies and fallback variants
- queues meme requests in FIFO order and processes one job at a time across all chats
- includes cooldown and ban-list protection for chat abuse control

## Requirements

- Node.js 18+
- pnpm or npm
- DeepSeek API key
- Telegram bot token

## Installation

```bash
pnpm install
```

Then configure the required values in `config.ts`:

```ts
deepseekApiKey: '', // your DeepSeek API key
deepseekModel: 'deepseek-flash',
botToken: 'your-telegram-bot-token',
botUsername: 'your-bot-username',
adminId: null, // your numeric Telegram user ID; null disables admin commands
```

Fill in `deepseekApiKey` in `config.ts` before starting the bot. An OpenAI API key cannot be used with DeepSeek.

Both image descriptions and caption generation use `deepseek-flash` at `https://api.deepseek.com`. Thinking is disabled with `reasoning_effort: 'none'` for short responses and temperature control; description and caption temperatures remain 0.1 and 0.7 respectively. Existing cached descriptions are reused.

Official documentation: [models](https://api-docs.deepseek.com/quick_start/pricing/), [Chat Completions parameters](https://api-docs.deepseek.com/api/create-chat-completion/), and [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/).

The project also contains prompt templates and caption-generation rules in `config.ts`, which you can adjust if needed.

## Puppeteer / Chrome dependencies

On Linux, Puppeteer may require additional system packages. Install them with:

```bash
sudo apt install google-chrome ttf-mscorefonts-installer libx11-xcb1 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 libasound2 libpangocairo-1.0-0 libxss1 libgtk-3-0
```

## Run

```bash
pnpm start
```

## Notes

- `index.ts` contains the Telegram bot logic and caption generation pipeline.
- `captions/` stores cached caption data for repeated images.
- `queue.ts` serializes download, generation, rendering, and delivery without blocking incoming Telegram updates. Failed jobs do not stop the queue.
- The queue is held in memory: graceful shutdown drains accepted jobs, but a crash or forced termination loses pending jobs. Run a single bot process to keep one global queue.
- `ecosystem.config.cjs` is included for PM2-based process management

## Ban list administration

Only the Telegram user specified by `adminId` in `config.ts` can use `/admin`, and only in a private chat with the bot. It is disabled while `adminId` is `null`.

- `/admin` — show help
- `/admin ban <ID>` — block a user or chat
- `/admin unban <ID>` — unblock a user or chat
- `/admin list` — show blocked IDs

Changes are saved to `banlist.json` and survive restarts. When this file does not exist, `config.banList` supplies the initial list; once saved, the file is authoritative. Keep it on persistent storage. Requests still waiting in the queue are checked again before processing; an already running job is not cancelled.
