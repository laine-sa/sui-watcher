import { Metric } from "./Metric"

export type Failure = {
    start: Date,
    last_observed: Date,
    end: Date|null,
    type: Metric|string,
    message: string,
    count: number,
    notified: boolean,
    resolved: boolean
}