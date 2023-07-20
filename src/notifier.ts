import axios from 'axios'
import * as log4js from "log4js"
import { Failure } from './types/Failure'
import { NotifierConstructorParams } from './types/NotifierConstructorParams'
import { NotifierChannels } from './types/NotifierChannels'
require('dotenv').config()

const DEFAULT_NOTIFIER_MONITOR_REFRESH_INTERVAL: number = 10000 // 10 seconds
const ALERT_THRESHOLD: number = (process.env.FAILURE_COUNT_ALERT_THRESHOLD!=undefined) ? parseInt(process.env.FAILURE_COUNT_ALERT_THRESHOLD) : 4

export class Notifier  {
    private logger: log4js.Logger
    private channels: NotifierChannels = {
        slack: null,
        pagerduty: null
    }

    public constructor(params: NotifierConstructorParams) {
        this.logger = params.logger
        this.register_channels()
    }

    public async monitor(failures: Failure[]): Promise<void> {
        this.logger.trace('Notifier loop start')
        failures.every((failure,i) => {
            if(!failure.notified && !failure.resolved && failure.count >= ALERT_THRESHOLD) {
                this.send_notifications(
                    failure.message
                    +'\r\n'+
                    'First observed: '+failure.start+'\r\n'+
                    'Last observed: '+failure.last_observed+' ('+failure.count+' times)'
                    )
            }
        })
        this.repeat_monitor(failures)
    }

    private repeat_monitor(failures: Failure[]) {
        setTimeout(() => this.monitor(failures), (process.env.NOTIFIER_MONITOR_REFRESH_INTERVAL != undefined) ? parseInt(process.env.NOTIFIER_MONITOR_REFRESH_INTERVAL) : DEFAULT_NOTIFIER_MONITOR_REFRESH_INTERVAL)
    }

    // Check which notification channels are set in the environment and record these
    private register_channels(): void {
        if(process.env.SLACK_WEBHOOK !== undefined && process.env.SLACK_WEBHOOK!='') 
            this.channels.slack = process.env.SLACK_WEBHOOK
        if(process.env.PAGERDUTY_INTEGRATION_KEY !== undefined && process.env.PAGERDUTY_INTEGRATION_KEY!='') 
            this.channels.pagerduty = process.env.PAGERDUTY_INTEGRATION_KEY
        
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
        }
    }
}