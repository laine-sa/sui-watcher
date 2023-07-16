# SUI WATCHER

This application is intended to run on an indepdent high-reliability host (e.g. a VPS) in order to monitor a Sui Validator node. In case of failures it can alert via Slack, Telegram or PagerDuty.

# Run Sui Watcher

Requires `ts-node` in your PATH/installed globally.

```ts-node run.ts```

# Configurable parameters

Copy the `.env.sample` file to `.env` and adjust appropriately.