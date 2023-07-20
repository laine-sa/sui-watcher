import axios from 'axios'
import * as log4js from "log4js"
import { Failure } from './types/Failure'
import { NotifierConstructorParams } from './types/NotifierConstructorParams'
import { NotifierChannels } from './types/NotifierChannels'
require('dotenv').config()
import hash from 'hash.js'

const DEFAULT_NOTIFIER_MONITOR_REFRESH_INTERVAL: number = 10000 // 10 seconds
export const ALERT_THRESHOLD: number = (process.env.FAILURE_COUNT_ALERT_THRESHOLD!=undefined) ? parseInt(process.env.FAILURE_COUNT_ALERT_THRESHOLD) : 4
const PAGERDUTY_URL = 'https://events.pagerduty.com/v2/enqueue'
const TELEGRAM_URL = 'https://api.telegram.org/bot'

export class Notifier  {
    private logger: log4js.Logger
    private target: string
    private channels: NotifierChannels = {}

    public constructor(params: NotifierConstructorParams) {
        this.logger = params.logger
        this.target = params.target
        this.logger.info('Initializing Notifier')

        this.register_channels()
    }

    public async monitor(failures: Failure[]): Promise<void> {
        this.logger.info('Notifier running')
        failures.every((failure,i) => {
            if(!failure.notified && !failure.resolved && failure.count >= ALERT_THRESHOLD) {
                let failure_message = failure.message
                +'\r\n'+
                'First observed: '+failure.start+'\r\n'+
                'Last observed: '+failure.last_observed+' ('+failure.count+' times)'

                this.logger.info('Notifier sending failure: '+failure_message)
                this.send_notifications(failure_message, failures, i, false)

                failures[i].notified = true
            }
            else if(failure.notified && failure.resolved && !failure.resolution_notified) {
                let resolution_message = 'ALL CLEAR - Resolution on '+failure.type
                +'\r\n'+
                'First observed: '+failure.start+'\r\n'+
                'Last observed: '+failure.last_observed+' ('+failure.count+' times)\r\n'+
                'Resolved: '+failure.end

                this.logger.info('Notifier sending resolution: '+resolution_message)
                this.send_notifications(resolution_message, failures, i, true)

                failures[i].resolution_notified = true
            }
        })
        this.repeat_monitor(failures)
    }

    private repeat_monitor(failures: Failure[]) {
        setTimeout(() => this.monitor(failures), (process.env.NOTIFIER_MONITOR_REFRESH_INTERVAL != undefined) ? parseInt(process.env.NOTIFIER_MONITOR_REFRESH_INTERVAL) : DEFAULT_NOTIFIER_MONITOR_REFRESH_INTERVAL)
    }

    // Check which notification channels are set in the environment and record these
    private register_channels(): void {
        let channel_count = 0
        if(process.env.SLACK_WEBHOOK !== undefined && process.env.SLACK_WEBHOOK!='') {
            this.channels.slack = process.env.SLACK_WEBHOOK
            channel_count++
        }
        if(process.env.PAGERDUTY_INTEGRATION_KEY !== undefined && process.env.PAGERDUTY_INTEGRATION_KEY!='') {
            this.channels.pagerduty = process.env.PAGERDUTY_INTEGRATION_KEY
            channel_count++
        }
        if(process.env.TELEGRAM_BOT_TOKEN !== undefined && process.env.TELEGRAM_BOT_TOKEN!='' &&
            process.env.TELEGRAM_CHAT_ID !== undefined && process.env.TELEGRAM_CHAT_ID!='') {
            this.channels.telegram = {
                token: process.env.TELEGRAM_BOT_TOKEN,
                chat_id: process.env.TELEGRAM_CHAT_ID
            }
            channel_count++
        }
            
        if(channel_count > 0) {
            this.logger.info('Notifier registered '+channel_count+' notification channels')
            // Send a notification to all channels that the notifier has started - exclude PagerDuty as this is not a critical notification
            this.send_notifications('SUI Watcher started for '+this.target+' and registered '+channel_count+' notification channels', [], 0, false, true)
        }
        else
            this.logger.warn('Notifier registered no notification channels')
    }

    private send_notifications(message: string, failures: Failure[], index: number, resolve: boolean, non_critical: boolean = false): void {
        if(this.channels.slack!=undefined) this.notify_slack(message)
        if(this.channels.pagerduty!=undefined && !non_critical) this.notify_pagerduty(message, failures, index, resolve)
        if(this.channels.telegram!=undefined) this.notify_telegram(message)
    }

    private notify_slack(message:string): void {
        if(this.channels.slack!=undefined) {
            axios.post(this.channels.slack,{
                text: message
            },
            {
                headers: {
                'Content-Type': 'application/json'
                }
            })
            .then((response) => {
                this.logger.trace('Notifier notified Slack')
            })
            .catch((error) => {
                this.logger.error('Notifier failed to notify Slack: '+error)
            })
        }
    }

    private notify_pagerduty(message:string, failures: Failure[], index: number, resolve: boolean): void {
        if(this.channels.pagerduty!=undefined) {
            let payload = {
                payload: {
                    summary: message,
                    timestamp: failures[index].start.toISOString(),
                    source: failures[index].type,
                    severity: 'critical',
                    custom_details: {
                        first_observed: failures[index].start.toISOString(),
                        last_observed: failures[index].last_observed.toISOString(),
                        count: failures[index].count
                    }
                },
                routing_key: this.channels.pagerduty,
                dedup_key: hash.sha256().update((failures[index].type+failures[index].start.toISOString())).digest('hex'),
                event_action: 'trigger'
            }
            if(resolve) {
                payload.event_action = 'resolve'
            }
            let payload_json = JSON.stringify(payload)

            this.logger.trace('Dedup key is '+payload.dedup_key)

            axios.post(PAGERDUTY_URL, payload_json,{
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload_json.length
                    }
            })
            
        }
    }

    private notify_telegram(message:string): void {
        if(this.channels.telegram!=undefined){
            let payload = {
                method: 'sendMessage',
                chat_id: this.channels.telegram.chat_id,
                text: message
            }
            
            axios.post(TELEGRAM_URL+this.channels.telegram.token+'/'+payload.method, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        }
    }
}