# Directive: Network Ping Application

## Goal
Create and maintain a web application hosted on Firebase that allows users to perform network pings to specific IP addresses or hostnames and visualize the results.

## Inputs
- Hostname or IP address (string)
- Number of pings (integer, default: 4)

## Tools/Scripts
- `execution/ping_tool.py`: Handles the actual ICMP pinging logic.
- `execution/notify_email.py`: Sends a failure alert email via SMTP. Reads credentials from `.env`.
- `execution/check_and_notify.py`: Orchestrator — runs ping, appends to `ping_log.json`, emails on failure. **Use this as the scheduled task entry point** instead of `ping_tool.py` directly.
- Firebase CLI: For hosting and cloud functions.

## Outputs
- UI: A premium, responsive web interface.
- Data: JSON objects containing latency (min, max, avg), packet loss, and status.

## Edge Cases
- Invalid IP/Hostname format.
- Host unreachable/down → `check_and_notify.py` will email NOTIFY_TO and log `notification_sent: true/false`.
- Permission issues on the server for ICMP packets.
- Network latency spikes.
- SMTP auth failure: check that `SMTP_PASSWORD` is a Gmail App Password (not the account password). Generate at myaccount.google.com → Security → App passwords.

## Maintenance
- Update `ping_tool.py` if pinging logic needs optimization.
- Scale UI as more network monitoring features are added.
