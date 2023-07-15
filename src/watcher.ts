import axios from 'axios'
import { Notifier } from './notifier'
import { Failure } from './types/Failure'
import { WatcherConstructorParams } from './types/WatcherConstructorParams'
import * as log4js from 'log4js'
import { WatchMetrics } from './types/WatchMetrics'
import { Metric } from './types/Metric'


export class Watcher {
    private notifier: Notifier = new Notifier()
    private failures: Failure[] = []
    private metrics: WatchMetrics[]|null = null
    private target: string|null = null
    private logger: log4js.Logger

    public constructor(params: WatcherConstructorParams) {
        this.target = params.target
        this.logger = params.logger

        this.logger.info('Initializing watcher with target: '+this.target)

        this.fetch_metrics()
    }

    public watch(): void {

        this.failures.push({
            start: new Date(),
            end: null,
            type: Metric.current_round,
            value: '',
            count: 0,
            notified: false,
            resolved: false
        })

        this.logger.trace(this.failures)

        this.notifier.notify(this.failures)

        this.logger.debug(this.failures)
    }

    private async fetch_metrics(): Promise<void> {
        if(this.target !== null) {

            this.logger.info('Fetching metrics from target: '+this.target)

            axios.get(this.target)
                .then(response => {
                    if(response.data != '') {
                        this.metrics = this.parse_metrics(response.data)
                        this.logger.trace(this.metrics)
                    }
                })
                .then(() => {
                    this.repeat_fetch_metrics()
                })
                .catch(error => {
                    this.logger.error('Unable to fetch metrics. Error: '+error)
                    this.repeat_fetch_metrics()
                })
        }
        
    }

    private repeat_fetch_metrics(): void {
        setTimeout(() => this.fetch_metrics(), (process.env.METRICS_REFRESH_INTERVAL != undefined) ? parseInt(process.env.METRICS_REFRESH_INTERVAL) : 5000)
    }

    private parse_metrics(metrics: string): WatchMetrics[] {
        let parsed: WatchMetrics[] = []

        let split = metrics.split(/\r?\n/)

        split.every(line => {
            if(parsed.length == Object.values(Metric).length) return false;

            let metric = line.split(' ')

            if(Object.values(Metric).includes(metric[0])) {
                parsed.push({
                    name: metric[0],
                    value: parseInt(metric[1])
                })
            }
            return true
        })

        return parsed
    }
}