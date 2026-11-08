import fs from "fs"
import path from "path";
import {config} from "zod";

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

    return filtered.map((item) => {
        const parts = item.description.split("<br>");
        const time = `${item.start.slice(11, 16)}-${item.end.slice(11, 16)}`;
        const teacher = parts[1]?.trim() || "Не указан";
        const type = parts[2]?.replace(/<\/?strong>/g, "").trim() || "Занятие";

        const dateObj = new Date(item.start);
        const dayOfWeek = dateObj.toLocaleDateString("ru-RU", {weekday: 'long'})

        return{
            date: item.start.slice(0, 10),
            dayOfWeek,
            time,
            subject: item.title,
            type,
            teacher,
            hasControlPoint: item.ControlPointNumber !== "0",
            hasUniversityPortalTask: item.NewTask !== "0"
        }
    })
}