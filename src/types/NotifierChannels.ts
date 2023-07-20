export type NotifierChannels = {
    slack?: string,
    pagerduty?: string,
    telegram?: {
        token: string,
        chat_id: string
    }
}