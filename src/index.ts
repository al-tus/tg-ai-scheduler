import { Bot } from "grammy";
import { config } from "./config";
import {processUserMessage, transcribeAudio} from './ai'

const bot = new Bot(config.BOT_TOKEN)

bot.use( async (ctx, next) => {
    if (ctx.from?.id !== config.ADMIN_ID) {
        console.log('Attempt from not allowed ID: ', ctx.from?.id)
        return
    }


    await next();
})

const TG_TAGS = "b|strong|i|em|u|ins|s|strike|del|code|pre|a|blockquote|tg-spoiler|tg-emoji"

// Оставляет теги Telegram как есть, экранирует только случайные & и <
function sanitizeTgHtml(s: string): string {
    return s
        .replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, "&amp;")
        .replace(new RegExp(`<(?!/?(?:${TG_TAGS})(?:\\s[^>]*)?>)`, "gi"), "&lt;")
}

async function handleUserRequest(ctx: any, text: string) {
    const replyText = await processUserMessage(text)
    await ctx.reply(replyText?.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>"), { parse_mode: "HTML" })
}

bot.on(["message:voice", "message:video_note"], async (ctx) => {
    const file = await ctx.getFile()
    const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
    const recognizedText = await transcribeAudio(fileUrl);

    await handleUserRequest(ctx, recognizedText.trim());
})

bot.on(["message:text"], async (ctx) => {
    const userText = ctx.message.text.trim();
    if (!userText) {return}

    await handleUserRequest(ctx, userText);
})

bot.catch((err) => {
    console.error("Bot error:", err.error)
    err.ctx.reply("Что-то пошло не так, попробуйте позже.").catch(() => {})
})

bot.start().catch((err) => {
    console.log(err)
    process.exit(1);
});



console.log("Bot running...");