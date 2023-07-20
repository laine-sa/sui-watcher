# SUI WATCHER

This application is intended to run on an indepdent high-reliability host (e.g. a VPS) in order to monitor a Sui Validator node. In case of failures it can alert via Slack, Telegram or PagerDuty.

# Run Sui Watcher

## Requirements

Clone the git repository and run `npm i`. Set up the `.env` file based on the sample provided.

Requires `ts-node` in your PATH/installed globally.

```ts-node run.ts```

# Configurable parameters

Copy the `.env.sample` file to `.env` and adjust appropriately.

Default Log Level is INFO, you can amend this in the `.env` file or specify it as an environment variable while running manually, e.g. `LOG_LEVEL=trace ts-node run.ts`

You need to specify at least one notification channel in order to receive alerts.

# Testing alerts

You can set `TEST_METRICS=true` and `TEST_FAIL=true` to simulate a failure (or set an invalid target URL to simulate a network connection failure). Additionally specify `TEST_RECOVERY=true` to simulate a recovery after the simulated failure (you may want to reduce the loop times in the .env file to accelerate this, e.g. set watch & notify loop to 5000)

# Notification Channels

Sui-Watcher supports a variety of notification channels, including Slack, PagerDuty and Telegram.

## Slack

To use Slack you need to create a custom integration with a webhook and get a webhook URL, then insert this in the `.env` file.

## PagerDuty

PagerDuty is probably the best option for high-fidelity devops alerting. Create a free account on pagerduty.com, create a Service, e.g. Sui or Sui-Mainnet and select the Events API v2 integration. If you already have a service you can add this integration to it. You'll then see an Events API v2 integration key on the service page, which is what you need to insert in the .env file.

Sui-Watcher will create incidents on PagerDuty as well as resolve them when it detects resolution.

## Telegram

Use the `Botfather` bot on Telegram to create your own Telegram bot. You can give it any name. If you have an existing bot you an use that too, you just need the bot token which you then specify in the `.env` file.

You also need your chat ID. The easiest way to find it is by searching Telegram for the `RawDataBot`, then clicking or typing `/start`. The bot will return some raw data about your Telegram account including the chat ID (labelled `id` under the `chat` object, before your name). This also needs to be added to the `.env` file.