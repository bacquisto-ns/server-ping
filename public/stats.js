document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('stats-table-body');
    const totalChecks = document.getElementById('total-checks');
    const hostsSeen = document.getElementById('hosts-seen');
    const avgLatency = document.getElementById('avg-latency');
    const avgLoss = document.getElementById('avg-loss');
    const datasetStatus = document.getElementById('dataset-status');
    const datasetMeta = document.getElementById('dataset-meta');

    loadPingLog();

    async function loadPingLog() {
        try {
            const response = await fetch('ping_log.json', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const entries = await response.json();
            if (!Array.isArray(entries) || entries.length === 0) {
                renderEmptyState('No ping records are available yet.');
                setSummary([], null);
                return;
            }

            const normalizedEntries = entries
                .map(normalizeEntry)
                .sort((left, right) => right.timestampValue - left.timestampValue);

            renderRows(normalizedEntries);
            setSummary(normalizedEntries, response);
        } catch (error) {
            renderEmptyState('Unable to load ping_log.json.');
            setSummary([], null, error);
        }
    }

    function normalizeEntry(entry) {
        const timestampValue = Date.parse(entry.timestamp || '');

        return {
            timestamp: entry.timestamp || 'Unknown',
            timestampValue: Number.isNaN(timestampValue) ? 0 : timestampValue,
            host: entry.host || 'Unknown host',
            resolvedIp: entry.resolved_ip || 'Unavailable',
            status: (entry.status || 'unknown').toLowerCase(),
            latencyAvgMs: typeof entry.latency_avg_ms === 'number' ? entry.latency_avg_ms : null,
            packetLossPct: typeof entry.packet_loss_pct === 'number' ? entry.packet_loss_pct : null
        };
    }

    function renderRows(entries) {
        tableBody.innerHTML = '';

        entries.forEach((entry) => {
            const row = document.createElement('tr');

            row.appendChild(createTextCell(formatDateTime(entry.timestampValue, entry.timestamp)));
            row.appendChild(createHostCell(entry.host, entry.timestampValue, entry.timestamp));
            row.appendChild(createTextCell(entry.resolvedIp));
            row.appendChild(createStatusCell(entry.status));
            row.appendChild(createMetricCell(formatLatency(entry.latencyAvgMs), entry.latencyAvgMs === null));
            row.appendChild(createMetricCell(formatLoss(entry.packetLossPct), entry.packetLossPct === null));

            tableBody.appendChild(row);
        });
    }

    function setSummary(entries, response, error) {
        const uniqueHosts = new Set(entries.map((entry) => entry.host));
        const avgLatencyValue = average(entries.map((entry) => entry.latencyAvgMs));
        const avgLossValue = average(entries.map((entry) => entry.packetLossPct));

        totalChecks.textContent = String(entries.length || 0);
        hostsSeen.textContent = String(uniqueHosts.size || 0);
        avgLatency.textContent = entries.length ? `${formatNumber(avgLatencyValue)} ms` : '--';
        avgLoss.textContent = entries.length ? `${formatNumber(avgLossValue)}%` : '--';

        if (error) {
            datasetStatus.textContent = 'Log unavailable';
            datasetMeta.textContent = error.message;
            return;
        }

        if (!entries.length) {
            datasetStatus.textContent = 'No records found';
            datasetMeta.textContent = 'Add entries to ping_log.json and refresh this page.';
            return;
        }

        const latest = entries[0];
        datasetStatus.textContent = `${entries.length} entries loaded`;
        datasetMeta.textContent = `Most recent host: ${latest.host} • HTTP ${response.status}`;
    }

    function renderEmptyState(message) {
        tableBody.innerHTML = '';
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.className = 'empty-state';
        cell.textContent = message;
        row.appendChild(cell);
        tableBody.appendChild(row);
    }

    function createTextCell(text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        return cell;
    }

    function createHostCell(host, timestampValue, rawTimestamp) {
        const cell = document.createElement('td');
        const wrapper = document.createElement('div');
        const hostName = document.createElement('div');
        const hostTimestamp = document.createElement('div');

        wrapper.className = 'host-cell';
        hostName.className = 'host-name';
        hostTimestamp.className = 'host-timestamp';

        hostName.textContent = host;
        hostTimestamp.textContent = `Captured ${formatRelative(timestampValue, rawTimestamp)}`;

        wrapper.appendChild(hostName);
        wrapper.appendChild(hostTimestamp);
        cell.appendChild(wrapper);

        return cell;
    }

    function createStatusCell(status) {
        const cell = document.createElement('td');
        const pill = document.createElement('span');
        const statusClass = status === 'online' || status === 'offline' ? status : 'unknown';

        pill.className = `status-pill ${statusClass}`;
        pill.textContent = statusClass;
        cell.appendChild(pill);

        return cell;
    }

    function createMetricCell(text, subtle) {
        const cell = document.createElement('td');
        cell.className = subtle ? 'metric-subtle' : 'metric';
        cell.textContent = text;
        return cell;
    }

    function average(values) {
        const usableValues = values.filter((value) => typeof value === 'number');
        if (!usableValues.length) {
            return 0;
        }

        const total = usableValues.reduce((sum, value) => sum + value, 0);
        return total / usableValues.length;
    }

    function formatDateTime(timestampValue, fallback) {
        if (!timestampValue) {
            return fallback;
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(timestampValue);
    }

    function formatRelative(timestampValue, fallback) {
        if (!timestampValue) {
            return fallback;
        }

        const diffMinutes = Math.round((Date.now() - timestampValue) / 60000);
        if (Math.abs(diffMinutes) < 1) {
            return 'just now';
        }
        if (Math.abs(diffMinutes) < 60) {
            return `${diffMinutes} min ago`;
        }

        const diffHours = Math.round(diffMinutes / 60);
        if (Math.abs(diffHours) < 24) {
            return `${diffHours} hr ago`;
        }

        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} day ago`;
    }

    function formatLatency(value) {
        return typeof value === 'number' ? `${value} ms` : 'Unavailable';
    }

    function formatLoss(value) {
        return typeof value === 'number' ? `${value}%` : 'Unavailable';
    }

    function formatNumber(value) {
        return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
});
