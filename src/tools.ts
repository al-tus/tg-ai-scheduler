import {z} from 'zod';
import {ChatCompletionTool} from "groq-sdk/resources/chat/completions";

export const createTaskSchema = z.object({
    title: z.string(),
    dueDate: z.string().optional(),
    addRoMyDay: z.boolean().optional(),
})



export const getScheduleSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
})

export const aiTools: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "create_task",
            description: "Создает новую задачу или напоминание в таск-трекере Microsoft To Do",
            parameters: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "Название задачи, четко и по делу (например: 'Сделать лабу по физике')"
                    },
                    dueDate: {
                        type: "string",
                        description: "Дата дедлайна в формате YYYY-MM-DD, если она упомянута",
                    },
                    addRoMyDay: {
                        type: "boolean",
                        description: "True, если задачу нужно сделать сегодня или добавить в список 'Мой день'",
                    }
                },
                required: ["title"],
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_schedule",
            description: "Получает список запланированных дел, задач, встреч или расписание пользователя на конкретный календарный день",
            parameters: {
                type: "object",
                properties: {
                    startDate: {
                        type: "string",
                        description: "Начальная дата в формате YYYY-MM-DD"
                    },
                    endDate: {
                        type: "string",
                        description: "Конечная дата в формате YYYY-MM-DD (если просят на один день, совпадает со startDate)"
                    }
                },
                required: ["startDate", "endDate"],
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_tasks",
            description: "Получает список текущих невыполненных задач и дедлайнов из Microsoft To Do",
            parameters: {
                type: "object",
                properties: {},
            }
        }
    }
]