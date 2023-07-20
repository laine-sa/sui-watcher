import { Watcher } from './src/watcher'
import * as log4js from 'log4js'
require('dotenv').config()

const log_level = (process.env.LOG_LEVEL != undefined) ? process.env.LOG_LEVEL : 'error'
const is_pm2 = (process.env.PM2 != undefined && process.env.PM2) ? true : false
const log_appenders = (process.env.LOG_STDOUT != undefined && !JSON.parse(process.env.LOG_STDOUT)) ? ["sui_watcher"] : ["sui_watcher", "out"]

log4js.configure({
    appenders: { sui_watcher: { type: "file", filename: "log/sui-watcher.log", maxLogSize: '100M', backups: 3 }, out: {type: "stdout"} },
    categories: { default: { appenders: log_appenders, level: log_level } },
    pm2: is_pm2
});

const swlogger = log4js.getLogger("swlogger")

if(process.env.TARGET == undefined) {
    swlogger.error('No target defined, shutting down.')
}
else {

    const watcher: Watcher = new Watcher({
        target: process.env.TARGET,
        logger: swlogger
    })
    
    watcher.watch()
}
