import {createPartFromFunctionResponse, GoogleGenAI} from "@google/genai"
import {config} from './config'
import {aiTools, createTaskSchema, getScheduleSchema} from "./tools";
import {createTodoTask, getActiveTasks} from "./todo";
import {getScheduleByRange} from "./schedule";
import {getSystemPrompt} from "./sp";


const gem = new GoogleGenAI({
    apiKey: config.GEMINI_API_KEY,
    httpOptions: { baseUrl: "https://gemini-proxy.timuraltuhov32.workers.dev"}

})

export async function transcribeAudio(fileUrl: string): Promise<string> {

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Failed to download file")

    const base64Data = Buffer.from(await response.arrayBuffer()).toString('base64')

    const transcription = await gem.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "audio/ogg",
                }
            },
            {text: 'Сделай точную транскрибацию этого аудио на русском языке.'}
        ]
    })

    return transcription.text ?? "Не удалось расшифровать аудио.";
}

export async function processUserMessage(text: string): Promise<string> {
    const sp = getSystemPrompt()
    const history = []
    console.log(text)

    const chat = gem.chats.create({
        model: config.GEMINI_MODEL,
        config: {
            systemInstruction: sp,
            tools: aiTools
        }
    });

    const response = await chat.sendMessage({
        message: text,
    })

    if (response.functionCalls && response.functionCalls.length > 0) {
        for (const functionCall of response.functionCalls) {
            const functionName = functionCall.name

            if (!functionCall.id || !functionCall.name) {
                throw new Error("Function call ID is missing");
            }

            let part;

            if (functionName == 'create_task') {
                    const arg = createTaskSchema.parse(functionCall.args);

                    const result = await createTodoTask(arg.title, arg.dueDate)

                    part =  createPartFromFunctionResponse(
                        functionCall.id!,
                        functionCall.name!,
                        { status: "success", createdTask: result,}
                    )
            }
            else if (functionName == 'get_tasks') {
                const tasks = await getActiveTasks()
                part = createPartFromFunctionResponse(
                    functionCall.id!,
                    functionCall.name!,
                    {tasks}
                )
            }
            else if (functionName == 'get_schedule') {
                const args = getScheduleSchema.parse(functionCall.args)

                const [lessons, tasks] = await Promise.all([
                    getScheduleByRange(args.startDate, args.endDate),
                    getActiveTasks()
                ])

                part = createPartFromFunctionResponse(
                    functionCall.id,
                    functionCall.name,
                    { schedule: lessons, activeTasks: tasks,}
                )
            }
            else {
                part = createPartFromFunctionResponse(
                    functionCall.id,
                    functionCall.name,
                    {  status: "error", message: `Unknown function: ${functionName}`}
                )
            }
            history.push(part)

        }

        console.log(response.functionCalls)

        const secondResp = await chat.sendMessage({
            message: history,
        })

        console.log(secondResp.functionCalls)

        return secondResp.text ?? "Не удалось получить ответ."
    }
    else {
        return response.text ?? "Не удалось получить ответ."
    }

}