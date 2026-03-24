export interface UserItem {
    sys_id: string
    name?: string
    number?: string
    short_description?: string
    sys_class_name: string
    class_display: string
    created_on?: string
    updated_on?: string
    state?: string
}

export interface UserItemsPayload {
    created: UserItem[]
    assigned: UserItem[]
}

export interface UserSuggestion {
    value: string
    label: string
    user_name: string
}

const SCRIPT_INCLUDE = 'x_1118332_brv.UserVisualizerService'

function callGlideAjax(method: string, params: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        // @ts-ignore - GlideAjax is injected globally by ServiceNow
        const ga = new GlideAjax(SCRIPT_INCLUDE)
        ga.addParam('sysparm_name', method)
        for (const [key, value] of Object.entries(params)) {
            ga.addParam(key, value)
        }
        ga.getXMLAnswer((response: string) => {
            if (response === null || response === undefined) {
                reject(new Error(`No response from ${method}`))
            } else {
                resolve(response)
            }
        })
    })
}

export async function getUserItems(userId: string, userName: string): Promise<UserItemsPayload> {
    const raw = await callGlideAjax('getUserItems', { 
        sysparm_user_id: userId,
        sysparm_user_name: userName 
    })
    const parsed = JSON.parse(raw)
    if (parsed.error) throw new Error(parsed.error)
    return parsed as UserItemsPayload
}

export async function searchUsers(query: string): Promise<UserSuggestion[]> {
    if (!query) return []
    const raw = await callGlideAjax('searchUsers', { sysparm_query: query })
    return JSON.parse(raw) as UserSuggestion[]
}

export async function getRecentUsers(): Promise<UserSuggestion[]> {
    const raw = await callGlideAjax('getRecentUsers')
    return JSON.parse(raw) as UserSuggestion[]
}

export async function saveUserPreference(user: UserSuggestion): Promise<void> {
    await callGlideAjax('saveUserPreference', { sysparm_user: JSON.stringify(user) })
}

export async function deleteUserPreference(userId: string): Promise<void> {
    await callGlideAjax('deleteUserPreference', { sysparm_user_id: userId })
}
