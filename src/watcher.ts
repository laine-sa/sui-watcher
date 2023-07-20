import axios from 'axios'
import { ALERT_THRESHOLD, Notifier } from './notifier'
import { Failure } from './types/Failure'
import { WatcherConstructorParams } from './types/WatcherConstructorParams'
import * as log4js from 'log4js'
import * as fs from 'fs'
import { WatchMetrics } from './types/WatchMetrics'
import { Metric } from './types/Metric'

const DEFAULT_METRICS_REFRESH_INTERVAL = 5000
const DEFAULT_WATCH_LOOP_INTERVAL = 15000

export class Watcher {
    private notifier: Notifier
    private failures: Failure[] = []
    private metrics: WatchMetrics[]|null = null // holds latest received metrics
    private previous_metrics: WatchMetrics[]|null = null // holds immediately previous round of metrics
    private target: string|null = null
    private logger: log4js.Logger
    private test_counter: number = 0

    public constructor(params: WatcherConstructorParams) {
        this.target = params.target
        this.logger = params.logger
        this.notifier = new Notifier({logger: params.logger, target: params.target})

        this.logger.info('Initializing watcher with target: '+this.target)
        if(process.env.TEST_METRICS != undefined && JSON.parse(process.env.TEST_METRICS)) this.logger.warn('Watcher is running in test mode')

        // This function runs async in a loop, fetches and updates metrics to this.metrics and this.previous_metrics
        this.fetch_metrics()

        // This function runs async in a loop, observes failures and triggers notifications
        this.notifier.monitor(this.failures)
    }

    // Main watch function loop that compares metrics values and pushes failures/resolutions
    public watch(): void {

        this.logger.info('Watching for failures')

        // Iterate the various tests/values
        if(this.previous_metrics !== null && this.metrics !== null) {
            this.metrics.every((value, i) => {
                if(this.previous_metrics !== null && value.value <= this.previous_metrics[i].value) {
                    this.logger.trace('Watcher detected a failure on '+value.name)

                    let error_value = 'Failure on '+this.target+' for '+value.name+', last value '+value.value+' is less or equal to previous value of '+this.previous_metrics[i].value
                    
                    this.logger.trace(error_value)
                    
                    this.process_failure({
                        start: new Date(),
                        last_observed: new Date(),
                        end: null,
                        type: value.name,
                        message: error_value,
                        count: 0,
                        notified: false,
                        resolved: false,
                        resolution_notified: false
                    })
                }
                else {
                    this.resolve_failure(value.name)
                }
            })
        }

        this.repeat_watch()
    }

    // This function fetches the metrics, handles test scenario and updates class properties that hold the data
    // Aside from failures on the defined metrics this function can trigger a failure on connection failure/timeout
    private async fetch_metrics(): Promise<void> {
        if(process.env.TEST_METRICS != undefined && !JSON.parse(process.env.TEST_METRICS)) {
            if(this.target !== null) {

                this.logger.info('Fetching metrics from target: '+this.target)
    
                axios.get(this.target)
                    .then(response => {
                        if(response.data != '') {

                            // If a connection failure exists resolve it now
                            this.resolve_failure('metrics_connection_error')

                            this.previous_metrics = this.metrics
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
                            error_value = error.code
                          } else {
                            error_value = error.message
                          }
                        this.logger.error('Unable to fetch metrics. Error: '+error_value)
                        this.process_failure({
                            start: new Date(),
                            last_observed: new Date(),
                            end: null,
                            type: 'metrics_connection_error',
                            message: 'Unable to fetch metrics: '+error_value,
                            count: 0,
                            notified: false,
                            resolved: false,
                            resolution_notified: false
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
                    this.previous_metrics = this.metrics
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
        setTimeout(() => this.fetch_metrics(), (process.env.METRICS_REFRESH_INTERVAL != undefined) ? parseInt(process.env.METRICS_REFRESH_INTERVAL) : DEFAULT_METRICS_REFRESH_INTERVAL)
    }

    private repeat_watch(): void {
        setTimeout(() => this.watch(), (process.env.WATCH_LOOP_INTERVAL != undefined) ? parseInt(process.env.WATCH_LOOP_INTERVAL) : DEFAULT_WATCH_LOOP_INTERVAL)
    }

    // Parse the Prometheus exporter metrics and record them, handles test scenario
    private parse_metrics(metrics: string, is_test: boolean = false): WatchMetrics[] {
        let parsed: WatchMetrics[] = []

        let split = metrics.split(/\r?\n/)

        let test_increment = 0
        
        if(is_test && process.env.TEST_FAIL != undefined && !JSON.parse(process.env.TEST_FAIL)) {
            test_increment = this.test_counter
        }
        else if(is_test && process.env.TEST_FAIL != undefined && JSON.parse(process.env.TEST_FAIL)) {
            if(process.env.TEST_RECOVERY != undefined && JSON.parse(process.env.TEST_RECOVERY) && this.test_counter > ALERT_THRESHOLD*2) {
            test_increment = this.test_counter
            }
        }
        this.test_counter++
        if(is_test) this.logger.trace('Test increment value is '+test_increment)

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

    // Process a failure observation and either create a new failure 
    // or update an existing unresolved one
    // Matches failure on type only
    // i.e. any failure of type current_round will match if an existing unresolved failure of this type exists
    private process_failure(failure: Failure): void {
        let match = this.failures.find(item => {
            if(!item.resolved && item.type === failure.type) return true
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
                count: match.count+1,
                notified: match.notified,
                resolved: match.resolved,
                resolution_notified: false
            }
        }
        else {
            this.failures.push(failure)
        }

        this.logger.trace('Current failures: ')
        this.logger.trace(this.failures)
    }

    // Mark a failure as resolved
    public resolve_failure(type: string): void {
        let match = this.failures.find(item => {
            if(!item.resolved && item.type === type) return true
            return false
        })
        if(match != undefined) {
            this.logger.info('Watcher detected a resolution on '+type)

            let index = this.failures.indexOf(match)
            this.failures[index] = {
                start: match.start,
                last_observed: match.last_observed,
                end: new Date(),
                type: match.type,
                message: match.message,
                count: match.count,
                notified: match.notified,
                resolved: true,
                resolution_notified: false
            }
        }
    }
}