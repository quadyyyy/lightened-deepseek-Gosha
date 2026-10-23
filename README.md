# Gosha

Gosha is a Telegram bot that generates crude meme-style captions for uploaded images. It uses DeepSeek V4.1 Flash via the OpenAI-compatible SDK, Telegram Bot API, and Puppeteer/Sharp-based image processing to react to screenshots and photos with short, chaotic, internet-style responses.

## Features

- accepts image messages in Telegram
- generates a caption in Russian, Ukrainian, or English
- describes the image to help produce more context-aware captions
- caches generated captions by image hash in the `captions/` directory
- supports multiple generation strategies and fallback variants
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
deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
deepseekModel: 'deepseek-flash',
botToken: 'your-telegram-bot-token',
botUsername: 'your-bot-username',
```

Set `DEEPSEEK_API_KEY` in the environment before starting the bot (or fill in `deepseekApiKey` locally). An OpenAI API key cannot be used with DeepSeek.

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
- `ecosystem.config.cjs` is included for PM2-based process management
