import {z} from 'zod';
import {Tool, Type} from '@google/genai';

export const createTaskSchema = z.object({
    title: z.string(),
    dueDate: z.string().optional(),
    addRoMyDay: z.boolean().optional(),
})



export const getScheduleSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
})

export const aiTools: Tool[] = [
    {
        functionDeclarations: [
            {
                name: "create_task",
                description:
                    "Создает новую задачу или напоминание в таск-трекере Microsoft To Do",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description:
                                "Название задачи, четко и по делу (например: 'Сделать лабу по физике')",
                        },
                        dueDate: {
                            type: Type.STRING,
                            description:
                                "Дата дедлайна в формате YYYY-MM-DD, если она упомянута",
                        },
                        addRoMyDay: {
                            type: Type.BOOLEAN,
                            description:
                                "True, если задачу нужно сделать сегодня или добавить в список 'Мой день'",
                        },
                    },
                    required: ["title"],
                },
            },
            {
                name: "get_schedule",
                description:
                    "Получает список запланированных дел, задач, встреч или расписание пользователя на конкретный календарный день",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        startDate: {
                            type: Type.STRING,
                            description: "Начальная дата в формате YYYY-MM-DD",
                        },
                        endDate: {
                            type: Type.STRING,
                            description:
                                "Конечная дата в формате YYYY-MM-DD (если просят на один день, совпадает со startDate)",
                        },
                    },
                    required: ["startDate", "endDate"],
                },
            },
            {
                name: "get_tasks",
                description:
                    "Получает список текущих невыполненных задач и дедлайнов из Microsoft To Do",
                // Для функции без аргументов `parameters` можно просто опустить
            },
        ],
    },
]