import {z} from "zod";
import 'dotenv/config'

const reqString = z.string().trim().min(1, "The variable is missing or empty")

const envSchema = z.object({
    BOT_TOKEN: reqString,
    GROQ_API_KEY: reqString,
    GROQ_MODEL: reqString,
    MS_CLIENT_ID: reqString,
    MS_CLIENT_SECRET: reqString,
    MS_REFRESH_TOKEN: reqString,
    ADMIN_ID: z.coerce.number().positive()
})

export const config = envSchema.parse(process.env)
