import { config } from "./config"

interface GraphTask {
    title: string;
    dueDateTime?: {
        dateTime: string;
        timeZone: string;
    } | null;
    importance?: 'low' | 'normal' | 'high';
}


async function getAccessToken(): Promise<string> {
    const params = new URLSearchParams({
        client_id: config.MS_CLIENT_ID,
        client_secret: config.MS_CLIENT_SECRET,
        refresh_token: config.MS_REFRESH_TOKEN,
        grant_type: 'refresh_token',
        scope: "Tasks.ReadWrite offline_access",
    })

    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: 'POST',
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: params.toString(),
    });

    const data = await response.json();
    if(!response.ok) {
        throw new Error(`MS Auth Error: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

async function getDefaultListContext() {
    const token = await getAccessToken();

    const response = await fetch("https://graph.microsoft.com/v1.0/me/todo/lists", {
        headers: {'Authorization': 'Bearer ' + token},
    });

    const lists = await response.json();
    const defaultList = lists.value.find((l: any) => l.wellknownListName === "defaultList") || lists.value[0];

    return {
        token,
        defaultListId: defaultList.id
    };
}

export async function createTodoTask(title: string, dueDate?: string){
    const {token, defaultListId} = await getDefaultListContext();

    const taskBody: Record<string, any> = { title };

    if (dueDate) {
        taskBody.dueDateTime = {
            dateTime: `${dueDate}T18:00:00`,
            timeZone: "Europe/Samara",
        }
    }

    const taskRes = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${defaultListId}/tasks`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(taskBody),
    });

    if (!taskRes.ok) {
        const err = await taskRes.text();
        throw new Error(`Failed to create task: ${err}`);
    }

    return await taskRes.json();
}

export async function getActiveTasks(){

    const {token, defaultListId} = await getDefaultListContext();

    const url = `https://graph.microsoft.com/v1.0/me/todo/lists/${defaultListId}/tasks?$filter=status ne 'completed'`

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.status}`);
    }

    const data = await response.json();
    return data.value.map((task: GraphTask) => ({
        title: task.title,
        dueDate: task.dueDateTime ? task.dueDateTime.dateTime : null,
        isStarred: task.importance === 'high'
    }));
}