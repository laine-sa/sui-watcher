import axios from 'axios'
import * as log4js from "log4js"
import { Failure } from './types/Failure'
import { NotifierConstructorParams } from './types/NotifierConstructorParams'
import { NotifierChannels } from './types/NotifierChannels'
require('dotenv').config()

const DEFAULT_NOTIFIER_MONITOR_REFRESH_INTERVAL: number = 10000 // 10 seconds
export const ALERT_THRESHOLD: number = (process.env.FAILURE_COUNT_ALERT_THRESHOLD!=undefined) ? parseInt(process.env.FAILURE_COUNT_ALERT_THRESHOLD) : 4

export class Notifier  {
    private logger: log4js.Logger
    private channels: NotifierChannels = {
        slack: null,
        pagerduty: null
    }

    public constructor(params: NotifierConstructorParams) {
        this.logger = params.logger
        this.logger.info('Initializing Notifier')

        this.register_channels()
    }

    public async monitor(failures: Failure[]): Promise<void> {
        this.logger.trace('Beginning notify loop')
        failures.every((failure,i) => {
            if(!failure.notified && !failure.resolved && failure.count >= ALERT_THRESHOLD) {
                let failure_message = failure.message
                +'\r\n'+
                'First observed: '+failure.start+'\r\n'+
                'Last observed: '+failure.last_observed+' ('+failure.count+' times)'

                this.logger.info('Notifier sending failure: '+failure_message)
                this.send_notifications(failure_message)

                failures[i].notified = true
            }
            else if(failure.notified && failure.resolved && !failure.resolution_notified) {
                let resolution_message = 'ALL CLEAR - Resolution on '+failure.type
                +'\r\n'+
                'First observed: '+failure.start+'\r\n'+
                'Last observed: '+failure.last_observed+' ('+failure.count+' times)\r\n'+
                'Resolved: '+failure.end

                this.logger.info('Notifier sending resolution: '+resolution_message)
                this.send_notifications(resolution_message)

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
            
        if(channel_count > 0)
            this.logger.info('Notifier registered '+channel_count+' notification channels')
        else
            this.logger.warn('Notifier registered no notification channels')
    }

    private send_notifications(message: string): void {
        if(this.channels.slack!=null) this.notify_slack(message)
    }

    private notify_slack(message:string): void {
        if(this.channels.slack!=null) {
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
}