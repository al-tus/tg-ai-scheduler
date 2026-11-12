import { Bot } from "grammy";
import { config } from "./config";
import {processUserMessage, transcribeAudio} from './ai'
import { runInterval } from './schedule';
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first")

export const bot = new Bot(config.BOT_TOKEN)

runInterval();

bot.use( async (ctx, next) => {
    if (ctx.from?.id !== config.ADMIN_ID) {
        console.log('Attempt from not allowed ID: ', ctx.from?.id)
        return
    }


    await next();
})


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