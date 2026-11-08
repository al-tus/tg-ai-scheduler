import Groq from 'groq-sdk'
import {config} from './config'
import {aiTools, createTaskSchema, getScheduleSchema} from "./tools";
import {ChatCompletionMessage} from "groq-sdk/resources/chat";
import {ChatCompletionMessageParam} from "groq-sdk/resources/chat";
import {createTodoTask, getActiveTasks} from "./todo";
import {getScheduleByRange} from "./schedule";
import {getSystemPrompt} from "./sp";

const groq = new Groq({ apiKey: config.GROQ_API_KEY })

const sp = getSystemPrompt()

export async function transcribeAudio(fileUrl: string): Promise<string> {

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Failed to download file")

    const arrayBuffer = await response.arrayBuffer();
    const audioFile = new File([arrayBuffer], "voice.ogg", {type: "audio/ogg"});

    const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-large-v3-turbo",
        language: "ru",
    })

    return transcription.text;
}

export async function processUserMessage(text: string): Promise<ChatCompletionMessage> {
    const messages: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: sp
        },
        {
            role: "user",
            content: text
        },
    ];

    const chatCompletion = await groq.chat.completions.create({
        model: config.GROQ_MODEL,
        messages: messages,
        tools: aiTools,
        tool_choice: 'auto',
        temperature: 0.2,
    });

    const responseMessage = chatCompletion.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        messages.push(responseMessage)

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const rawArgs = toolCall.function.arguments;

            let functionResponse: string;

            if (functionName == 'create_task') {
                const parsed = JSON.parse(rawArgs);
                const arg = createTaskSchema.parse(parsed);

                const result = await createTodoTask(arg.title, arg.dueDate)

                functionResponse = JSON.stringify({
                    status: "success",
                    createdTask: result,
                })

            }
            else if (functionName == 'get_tasks') {
                const tasks = await getActiveTasks();
                functionResponse = JSON.stringify(tasks);
            }
            else if (functionName == 'get_schedule') {
                const parsed = JSON.parse(rawArgs);
                const args = getScheduleSchema.parse(parsed);

                const [lessons, tasks] = await Promise.all([
                    getScheduleByRange(args.startDate, args.endDate),
                    getActiveTasks()
                ]);

                functionResponse = JSON.stringify({
                    schedule: lessons,
                    activeTasks: tasks,
                })
            }
            else {
                functionResponse = JSON.stringify({
                    status: "error",
                    message: `Unknown function: ${functionName}`,
                });
            }

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: functionResponse,
            })
        }

        const secondCompletion = await groq.chat.completions.create({
            model: config.GROQ_MODEL,
            messages: messages,
            temperature: 0.2,
        })

        return secondCompletion.choices[0].message;
    }
    else {
        return responseMessage;
    }
}