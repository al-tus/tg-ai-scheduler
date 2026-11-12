import fs from "fs"
import path from "path";
import {processUserMessage} from "./ai";
import {config} from "./config";
import {bot} from "./index";

interface RawLesson {
    ID: string;
    title: string;
    start: string;
    end: string;
    description: string;
    NewTask: string;
    ControlPointNumber: string;
}

export interface CleanLesson {
    date: string;
    dayOfWeek: string;
    time: string;
    subject: string;
    type: string;
    status: string;
    teacher: string;
    hasControlPoint: boolean;
    hasUniversityPortalTask: boolean;
}

export function getScheduleByRange(startDate: string, endDate: string): CleanLesson[] {
    const filePath = path.join(process.cwd(), "src", "schedules.json");
    const rawDate: RawLesson[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const uniqueLessons = Array.from(new Map(rawDate.map(item => [item.ID, item])).values());

    const filtered = uniqueLessons.filter((item) => {
        const lessonDate = item.start.slice(0, 10);
        return lessonDate >= startDate && lessonDate <= endDate;
    })

    filtered.sort((a, b) => a.start.localeCompare(b.start));
    const now = new Date();
    const todayIso = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Samara" });
    const currentHm = now.toLocaleTimeString("ru-RU", {
        timeZone: "Europe/Samara",
        hour: "2-digit",
        minute: "2-digit",
    });


    return filtered.map((item) => {
        const parts = item.description.split("<br>");
        const startHm = item.start.slice(11, 16);
        const endHm = item.end.slice(11, 16);
        const time = `${startHm}-${endHm}`;
        const teacher = parts[1]?.trim() || "Не указан";
        const type = parts[2]?.replace(/<\/?strong>/g, "").trim() || "Занятие";
        const dateObj = new Date(item.start);
        const lessonDate = item.start.slice(0, 10);

        const dayOfWeek = dateObj.toLocaleDateString("ru-RU", {weekday: 'long'})
        let status: "прошла" | "идет сейчас" | "предстоит" = "предстоит";
        if (lessonDate < todayIso || (lessonDate === todayIso && endHm <= currentHm)) {
            status = "прошла";
        } else if (lessonDate === todayIso && startHm <= currentHm && endHm > currentHm) {
            status = "идет сейчас";
        }

        return{
            date: item.start.slice(0, 10),
            dayOfWeek,
            time,
            status,
            subject: item.title,
            type,
            teacher,
            hasControlPoint: item.ControlPointNumber !== "0",
            hasUniversityPortalTask: item.NewTask !== "0"
        }
    })
}
function buildUrl() {
    const now = new Date();
    const end = new Date()

    const nowDate = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Samara" });
    const endDate = new Date(end.setMonth(end.getMonth() + 3)).toLocaleDateString("sv-SE", { timeZone: "Europe/Samara" })

    return (
        `https://lk.samgtu.ru/api/common/distancelearning?start=${nowDate}T00%3A00%3A00%2B04%3A00&end=${endDate}T00%3A00%3A00%2B04%3A00`
    )
}

async function getCachedSchedule(filePath: string): Promise<RawLesson[]>{
    try {
        const response = fs.readFileSync(filePath, "utf-8")
        return JSON.parse(response);
    }catch (err) {
        console.log(err);
        return [];
    }
}

async function findScheduleChanges(oldList: RawLesson[], newList: RawLesson[]): Promise<string[]> {
    const changes: string[] = [];

    const oldMap = new Map<string, RawLesson>(oldList.map(item => [item.ID, item]))
    const newMap = new Map<string, RawLesson>(newList.map(item => [item.ID, item]))


    for (const [id, newItem] of newMap) {
        const parts = newItem.description.split("<br>");
        const type = parts[2]?.replace(/<\/?strong>/g, "").trim() || "Занятие";

        if (!oldMap.has(id)) {
            changes.push(JSON.stringify({
                event: `Появилась новая пара: ${newItem.title}.`,
                ID: id,
                title: newItem.title,
                start: newItem.start,
                type: type,
                end: newItem.end,
            }))
        }
        else {
            const oldItem = oldMap.get(id)

            if(!oldItem || oldItem.start !== newItem.start || oldItem.end !== newItem.end){
                changes.push(JSON.stringify({
                    event: `Изменино время пары. Было: ${oldItem?.start}-${oldItem?.end}, стало ${newItem.start}-${newItem.end}.`,
                    ID: id,
                    title: newItem.title,
                    type: type,
                    start: newItem.start,
                    end: newItem.end,
                }))
            }
            if(!oldItem || oldItem.NewTask === '0' && newItem.NewTask !== "0") {
                changes.push(JSON.stringify({
                    event: `Получино новое задание`,
                    ID: id,
                    title: newItem.title,
                    type: type,
                    start: newItem.start,
                    end: newItem.end,
                }))
            }
            if(!oldItem || oldItem.ControlPointNumber === '0' && newItem.ControlPointNumber !== "0") {
                changes.push(JSON.stringify({
                    event: `Назначена контрольная точка.`,
                    ID: id,
                    title: newItem.title,
                    type: type,
                    start: newItem.start,
                    end: newItem.end,
                }))
            }
        }
    }
    const todayIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Samara" });

    for (const [id, oldItem] of oldMap) {

        if (oldItem.start.slice(0, 10) < todayIso || newMap.has(id)) {
            continue;
        }

        const isMergedIntoAnother = newList.some((otherNewItem) =>
            otherNewItem.title === oldItem.title &&
            otherNewItem.start <= oldItem.start &&
            otherNewItem.end >= oldItem.end
        )

        if(!isMergedIntoAnother) {
            const parts = oldItem.description.split("<br>");
            const type = parts[2]?.replace(/<\/?strong>/g, "").trim() || "Занятие";

            changes.push(JSON.stringify({
                event: `Отмена пары: ${oldItem.title}.`,
                ID: id,
                type: type,
                title: oldItem.title,
                start: oldItem.start,
                end: oldItem.end,
            }))
        }
    }

    return changes;

}

async function saveRawSchedule(filePath: string, data:  RawLesson[]) {
    try{
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.log(error);
    }
}

async function fetchLiveSchedule(): Promise<RawLesson[]> {

        const url = buildUrl()

        const response = await fetch(url, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
                'Referer': 'https://lk.samgtu.ru/distancelearning/distancelearning/index',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Cookie': `_identity=${config.COOKIE_IDENTITY}; _csrf=${config.COOKIE_CSRF}; PHPSESSID=${config.PHPSESSID}`
            }
        });

        const data = await response.json()

        if (!response.ok || !Array.isArray(data)) {
            throw new Error("SamGTU API error")
        }
        return data ?? []
}


async function checkSchedule() {

    const cachePath = 'src/schedules.json';

    const [oldList, newList] = await Promise.all([
        getCachedSchedule(cachePath),
        fetchLiveSchedule()
    ]);

    if (newList.length === 0) {
        return;
    }
    if (oldList.length === 0) {
        await saveRawSchedule(cachePath, newList);
        return;
    }

    const changes = await findScheduleChanges(oldList, newList);

    if (changes && changes.length > 0) {
        const formattedChanges = changes.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join('\n');

        const prompt = `В расписании вуза произошли изменения:\n${formattedChanges}\n\nКоротко и бодро сообщи мне об этом!`;

        const aiAnalysis = await processUserMessage(prompt);

        const myChatId = config.ADMIN_ID;
        if (myChatId) {
            await bot.api.sendMessage(myChatId, aiAnalysis, {
                parse_mode: "HTML"
            });
        }
    }

    await saveRawSchedule(cachePath, newList);
}

export async function runInterval() {
    await checkSchedule();
    setTimeout(runInterval, 3600000);
}
