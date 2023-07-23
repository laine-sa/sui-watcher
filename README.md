# SUI WATCHER

This application is intended to run on an indepdent high-reliability host (e.g. a VPS) in order to monitor a Sui Validator node. In case of failures it can alert via Slack, Telegram or PagerDuty.

## Running

Requires a relatively new version of node.js as well as global ts-node and typescript (`npm i -g ts-node` and `npm i -g typescript`)

Clone the git repository and run `npm i`. Set up the `.env` file based on the sample provided.

Requires `ts-node` in your PATH/installed globally.

```ts-node run.ts```

### Backround service with pm2

For continuous background operation we recommend using pm2, a process manager for node.js. Ensure you first follow the prior pre-requsities for global `ts-node` and configure your `.env` file.

To allow for multiple targets modify the pm2 config files on the `pm2` directory, e.g. `pm2/mainnet.config.js` to specify the correct TARGET.

You can then use the script in the pm2 directory of this repo to run the service:

```pm2 start pm2/mainnet.config.js```
```pm2 start pm2/testnet.config.js```

You can check that the sui-watcher is running either by tailing the log file or with `pm2 status` - you should also get a notification via Telegram and/or Slack if configured. If you've made changes and need to restart use `pm2 restart sui-watcher-mainnet`

You can make additional copies of the pm2 config file for additional targets you want to monitor.

## Configurable parameters

Copy the `.env.sample` file to `.env` and adjust appropriately.

Default Log Level is INFO, you can amend this in the `.env` file or specify it as an environment variable while running manually, e.g. `LOG_LEVEL=trace ts-node run.ts`

You need to specify at least one notification channel in order to receive alerts.

## Testing alerts

You can set `TEST_METRICS=true` and `TEST_FAIL=true` to simulate a failure (or set an invalid target URL to simulate a network connection failure). Additionally specify `TEST_RECOVERY=true` to simulate a recovery after the simulated failure (you may want to reduce the loop times in the .env file to accelerate this, e.g. set watch & notify loop to 5000)

## Notification Channels

Sui-Watcher supports a variety of notification channels, including Slack, PagerDuty and Telegram.

### Slack

To use Slack you need to create a custom integration with a webhook and get a webhook URL, then insert this in the `.env` file.

### PagerDuty

PagerDuty is probably the best option for high-fidelity devops alerting. Create a free account on pagerduty.com, create a Service, e.g. Sui or Sui-Mainnet and select the Events API v2 integration. If you already have a service you can add this integration to it. You'll then see an Events API v2 integration key on the service page, which is what you need to insert in the .env file.

Sui-Watcher will create incidents on PagerDuty as well as resolve them when it detects resolution.

### Telegram

Use the `Botfather` bot on Telegram to create your own Telegram bot. You can give it any name. If you have an existing bot you an use that too, you just need the bot token which you then specify in the `.env` file.

You also need your chat ID. The easiest way to find it is by searching Telegram for the `RawDataBot`, then clicking or typing `/start`. The bot will return some raw data about your Telegram account including the chat ID (labelled `id` under the `chat` object, before your name). This also needs to be added to the `.env` file.

## Logging

Sui-watcher defaults to the INFO log level. You can amend this up/down to ERROR, WARN, DEBUG or TRACE. Logs are printed to STDOUT as well as `log/sui-watcher.log`. If you are using pm2 you won't see logs on stdout but can tail the log file. Logs will rotate when they reach 100M and 3 backups will be kept.