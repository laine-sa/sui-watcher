// Replace the TARGET value with your metrics endpoint, then use pm2 start pm2/mainnet.config.js to start the watcher. 
// Copy this file and modify for additional networks/validators and adjust the name accordingly.
// To manage the process use pm2 status and pm2 stop sui-watcher-mainnet

module.exports = {
    apps : [
        {
          name: "sui-watcher-mainnet",
          script: "./pm2/pm2-start.sh",
          env: {
            "TARGET": "{YOUR_MAINNET_METRICS_ENDPOINT URL}",
          }
        }
    ]
  }