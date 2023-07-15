import { Metric } from "./Metric"

export type Failure = {
    start: Date,
    end: Date|null,
    type: Metric,
    value: string,
    count: number,
    notified: boolean,
    resolved: boolean
}