// Replace the TARGET value with your metrics endpoint, then use pm2 start pm2/testnet.config.js to start the watcher. 
// Copy this file and modify for additional networks/validators and adjust the name accordingly.
// To manage the process use pm2 status and pm2 stop sui-watcher-testnet

module.exports = {
    apps : [
        {
          name: "sui-watcher-testnet",
          script: "./pm2/pm2-start.sh",
          env: {
            "TARGET": "{YOUR_TESTNET_METRICS_ENDPOINT URL}",
          }
        }
    ]
  }