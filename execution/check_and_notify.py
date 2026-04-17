"""
Orchestrator: ping a host, log the result, and email on failure.
Usage: python execution/check_and_notify.py <hostname>
"""
import json
import os
import sys
from datetime import datetime, timezone

# Resolve paths relative to this file so the script works from any cwd
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
LOG_FILE = os.path.join(PROJECT_DIR, "ping_log.json")

sys.path.insert(0, SCRIPT_DIR)
from ping_tool import ping
from notify_email import send_failure_email


def load_log():
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            return json.load(f)
    return []


def save_log(entries):
    with open(LOG_FILE, "w") as f:
        json.dump(entries, f, indent=2)


def run(host: str):
    result = ping(host)
    timestamp = datetime.now(timezone.utc).isoformat()

    log_entry = {
        "timestamp": timestamp,
        "host": result.get("host"),
        "status": result.get("status"),
        "latency_avg_ms": result.get("latency_avg"),
        "packet_loss_pct": result.get("packet_loss"),
        "resolved_ip": None,
        "notification_sent": False,
    }

    # Extract resolved IP from raw output if available
    import re
    raw = result.get("raw", "")
    ip_match = re.search(r'\[([^\]]+)\]', raw)
    if ip_match:
        log_entry["resolved_ip"] = ip_match.group(1)

    # Send email notification on failure
    if result.get("status") == "offline":
        notify_result = send_failure_email(
            host=host,
            error=result.get("error", ""),
            raw=raw,
        )
        log_entry["notification_sent"] = notify_result.get("sent", False)
        log_entry["notification_error"] = notify_result.get("error")
        print(f"[OFFLINE] {host} — notification sent: {notify_result.get('sent')}")
    else:
        print(f"[ONLINE]  {host} — latency {log_entry['latency_avg_ms']}ms, {log_entry['packet_loss_pct']}% loss")

    log = load_log()
    log.append(log_entry)
    save_log(log)
    print(f"Logged. Total entries: {len(log)}")
    return log_entry


if __name__ == "__main__":
    hosts_to_ping = sys.argv[1:]
    
    # Ensure our required default hosts are always checked
    required_hosts = ["NS-FileDecryptor", "199.180.241.202"]
    for req_host in required_hosts:
        if req_host not in hosts_to_ping:
            hosts_to_ping.append(req_host)
        
    for h in hosts_to_ping:
        run(h)
