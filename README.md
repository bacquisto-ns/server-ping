# server-ping

Simple ICMP reachability check + log for the office server.

## Usage

```sh
./ping-server.sh                  # pings NS-FileDecryptor, 10 packets
./ping-server.sh NS-FileDecryptor 20
```

Logs are written to `logs/ping-<host>-<UTC-timestamp>.log`. Exit code
is non-zero if any packets are lost or the host does not respond, so it
can be wired into cron/monitoring.

## Scheduling (example)

```
*/5 * * * * /path/to/server-ping/ping-server.sh NS-FileDecryptor 5 >/dev/null
```
