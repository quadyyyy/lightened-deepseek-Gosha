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

## Video and GIF reactions (Gemini)

`video-reactions.ts` handles full video uploads directly through Google's Files API and
`generateContent`, using the existing Axios dependency. It does not extract still frames.
The separate `VIDEO_PROMPT` controls Gosha's short text reaction; override it with
`geminiVideo.prompt` in `config.ts` if desired. Image generation still uses DeepSeek.

Install `ffmpeg` (including `ffprobe`) on the bot host, then configure:

```bash
export GEMINI_API_KEY='your-google-ai-studio-key'
export GEMINI_VIDEO_MODEL='gemini-2.5-flash-lite'
pnpm start
```

The default is `gemini-2.5-flash-lite`, a low-cost model with video/audio input.
Google limits 2.5 access to existing users; if unavailable for your key, set
`GEMINI_VIDEO_MODEL=gemini-3.5-flash-lite`. The environment variable overrides the default.
The same settings can be set in `config.ts` under `geminiVideo`. Without a key the bot
replies that video reactions are not configured and does not download or upload media.
A live Gemini request has not yet been verified with an API key.

In groups, mention `@your_bot_username` in a video's caption, or reply to a video/GIF
with a configured trigger such as `гоша`. In private chats, send the media directly.
The response is plain text replying to the original media, including in forum topics.
Telegram videos, animations (usually MP4), and GIF documents are supported.
Limits: 5 minutes and 20 MiB, including a check of actual file duration using ffprobe.
FFmpeg converts the complete clip to MP4 with audio retained when present; GIF animation
is preserved. Conversion is bounded to 3 minutes and a single encoder thread.
Requests share the existing FIFO queue, user limits and ban list. Temporary local files
are removed; uploaded Google files are deleted after success or failure when their ID is known.

References: [Gemini Files API](https://ai.google.dev/gemini-api/docs/files) and
[generateContent](https://ai.google.dev/api/generate-content).
