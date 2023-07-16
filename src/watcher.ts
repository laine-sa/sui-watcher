import axios from 'axios'
import { Notifier } from './notifier'
import { Failure } from './types/Failure'
import { WatcherConstructorParams } from './types/WatcherConstructorParams'
import * as log4js from 'log4js'
import * as fs from 'fs'
import { WatchMetrics } from './types/WatchMetrics'
import { Metric } from './types/Metric'


export class Watcher {
    private notifier: Notifier = new Notifier()
    private failures: Failure[] = []
    private metrics: WatchMetrics[]|null = null
    private target: string|null = null
    private logger: log4js.Logger
    private test_counter: number = 0

    public constructor(params: WatcherConstructorParams) {
        this.target = params.target
        this.logger = params.logger

        this.logger.info('Initializing watcher with target: '+this.target)

        this.fetch_metrics()
    }

    public watch(): void {

        this.failures.push({
            start: new Date(),
            last_observed: new Date(),
            end: null,
            type: Metric.current_round,
            message: '',
            count: 0,
            notified: false,
            resolved: false
        })

        this.logger.trace(this.failures)

        this.notifier.notify(this.failures)

        this.logger.debug(this.failures)
    }

    private async fetch_metrics(): Promise<void> {
        if(process.env.TEST_METRICS != undefined && !JSON.parse(process.env.TEST_METRICS)) {
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
                        let error_value = 'Unknown'
                        
                        if (error.response) {
                            error_value = error.reponse.status+' '+error.response.data
                            
                            } else if (error.request) {
                            error_value = error.request
                          } else {
                            error_value = error.message
                          }
                        this.logger.error('Unable to fetch metrics. Error: '+error_value)
                        this.process_failure({
                            start: new Date(),
                            last_observed: new Date(),
                            end: null,
                            type: 'MetricsCollectionError',
                            message: error_value,
                            count: 0,
                            notified: false,
                            resolved: false
                        })

                        this.repeat_fetch_metrics()
                    })
            }
            else {
                this.logger.error('Target is null, unable to fetch metrics.')
            }
        }
        else {
            if(process.env.TEST_METRICS_FILENAME != undefined) {
                await fs.readFile(process.env.TEST_METRICS_FILENAME, 'utf-8', (err, data) => {
                    if(err) {
                        this.logger.error('Unable to open test metrics file: '+err.message)
                        return
                    }
                    this.metrics = this.parse_metrics(data,true)
                    this.logger.trace(this.metrics)
                })
                
                this.repeat_fetch_metrics()
                
            }
            else {
                this.logger.error('TEST_METRICS_FILENAME is not set')
            }
        }
        
    }

    private repeat_fetch_metrics(): void {
        setTimeout(() => this.fetch_metrics(), (process.env.METRICS_REFRESH_INTERVAL != undefined) ? parseInt(process.env.METRICS_REFRESH_INTERVAL) : 5000)
    }

    private parse_metrics(metrics: string, is_test: boolean = false): WatchMetrics[] {
        let parsed: WatchMetrics[] = []

        let split = metrics.split(/\r?\n/)

        let test_increment = (is_test && process.env.TEST_FAIL != undefined && !JSON.parse(process.env.TEST_FAIL))
            ?   this.test_counter
            : 0
        this.test_counter++
        this.logger.trace('Test increment value is '+test_increment)

        split.every(line => {
            if(parsed.length == Object.values(Metric).length) return false;

            let metric = line.split(' ')

            if(Object.values(Metric).includes(metric[0])) {
                parsed.push({
                    name: metric[0],
                    value: parseInt(metric[1]) + test_increment
                })
            }
            return true
        })

        return parsed
    }

    private process_failure(failure: Failure): void {
        let match = this.failures.find(item => {
            if(!item.resolved && item.type === failure.type && item.message == failure.message) return true
            return false
        })
        if(match != undefined) {
            let index = this.failures.indexOf(match)
            this.failures[index] = {
                start: match.start,
                last_observed: new Date(),
                end: null,
                type: match.type,
                message: match.message,
                count: match.count++,
                notified: match.notified,
                resolved: match.resolved
            }
        }
        else {
            this.failures.push(failure)
        }
    }
}