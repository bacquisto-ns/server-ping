document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('stats-table-body');
    const totalChecks = document.getElementById('total-checks');
    const hostsSeen = document.getElementById('hosts-seen');
    const avgLatency = document.getElementById('avg-latency');
    const avgLoss = document.getElementById('avg-loss');
    const datasetStatus = document.getElementById('dataset-status');
    const datasetMeta = document.getElementById('dataset-meta');

    let currentFilter = 'all';
    initSegmentedControl();
    loadPingLog();

    function initSegmentedControl() {
        const segmented = document.querySelector('.segmented');
        if (!segmented) return;
        const indicator = segmented.querySelector('.seg-indicator');
        const buttons = Array.from(segmented.querySelectorAll('.seg'));

        function moveIndicator(btn) {
            if (!btn) return;
            indicator.style.width = `${btn.offsetWidth}px`;
            indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
        }

        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                buttons.forEach((b) => b.setAttribute('aria-selected', 'false'));
                btn.setAttribute('aria-selected', 'true');
                currentFilter = btn.dataset.filter || 'all';
                moveIndicator(btn);
                applyFilter(currentFilter);
            });
        });

        requestAnimationFrame(() => {
            const selected = segmented.querySelector('.seg[aria-selected="true"]') || buttons[0];
            moveIndicator(selected);
        });

        window.addEventListener('resize', () => {
            const selected = segmented.querySelector('.seg[aria-selected="true"]');
            moveIndicator(selected);
        });
    }

    function applyFilter(filter) {
        const rows = tableBody.querySelectorAll('tr[data-status]');
        rows.forEach((row) => {
            if (filter === 'all' || row.dataset.status === filter) {
                row.classList.remove('row-filtered');
            } else {
                row.classList.add('row-filtered');
            }
        });
    }

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

        entries.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.classList.add('row-enter');
            row.style.setProperty('--row-index', Math.min(index, 20));
            const statusClass = entry.status === 'online' || entry.status === 'offline' ? entry.status : 'unknown';
            row.dataset.status = statusClass;
            if (index === 0) row.classList.add('is-latest');

            row.appendChild(createTextCell(formatDateTime(entry.timestampValue, entry.timestamp)));
            row.appendChild(createHostCell(entry.host, entry.timestampValue, entry.timestamp));
            row.appendChild(createTextCell(entry.resolvedIp));
            row.appendChild(createStatusCell(entry.status));
            row.appendChild(createMetricCell(formatLatency(entry.latencyAvgMs), entry.latencyAvgMs === null));
            row.appendChild(createMetricCell(formatLoss(entry.packetLossPct), entry.packetLossPct === null));

            tableBody.appendChild(row);
        });

        applyFilter(currentFilter);
    }

    function setSummary(entries, response, error) {
        const uniqueHosts = new Set(entries.map((entry) => entry.host));
        const avgLatencyValue = average(entries.map((entry) => entry.latencyAvgMs));
        const avgLossValue = average(entries.map((entry) => entry.packetLossPct));

        if (entries.length) {
            countUp(totalChecks, entries.length, { decimals: 0 });
            countUp(hostsSeen, uniqueHosts.size, { decimals: 0 });
            countUp(avgLatency, avgLatencyValue, { decimals: 1, suffix: ' ms' });
            countUp(avgLoss, avgLossValue, { decimals: 1, suffix: '%' });

            const latencyHistory = entries.map((e) => e.latencyAvgMs).reverse();
            const lossHistory = entries.map((e) => e.packetLossPct).reverse();

            renderSparkline('total-checks-spark', bucketCounts(entries, 14), { type: 'bar',  color: '#b5a5ff' });
            renderSparkline('hosts-seen-spark',   cumulativeUnique(entries),  { type: 'line', color: '#b5a5ff' });
            renderSparkline('avg-latency-spark',  latencyHistory,             { type: 'line', color: '#7ee3c8' });
            renderSparkline('avg-loss-spark',     lossHistory,                { type: 'line', color: '#ffc96d' });

            setTrend('avg-latency-trend', computeTrend(latencyHistory), { unit: ' ms', decimals: 1, lowerIsBetter: true });
            setTrend('avg-loss-trend',    computeTrend(lossHistory),    { unit: '%',   decimals: 1, lowerIsBetter: true });

            setOrbStatus(entries);
        } else {
            totalChecks.textContent = '0';
            hostsSeen.textContent = '0';
            avgLatency.textContent = '--';
            avgLoss.textContent = '--';
            setOrbStatus([]);
        }

        if (error) {
            datasetStatus.textContent = 'Log unavailable';
            datasetMeta.textContent = error.message;
            setOrbStatus([], { error: true });
            return;
        }

        if (!entries.length) {
            datasetStatus.textContent = 'No records found';
            datasetMeta.textContent = 'Add entries to ping_log.json and refresh this page.';
            return;
        }

        const latest = entries[0];
        datasetStatus.textContent = describeOrbStatus(document.getElementById('status-orb').dataset.status);
        datasetMeta.textContent = `${entries.length} entries • latest host ${latest.host} • HTTP ${response.status}`;
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

    function countUp(element, target, options = {}) {
        const { decimals = 0, suffix = '', duration = 900 } = options;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const finalText = `${formatWithDecimals(target, decimals)}${suffix}`;

        if (reduced || !Number.isFinite(target)) {
            element.textContent = finalText;
            return;
        }

        const start = performance.now();
        const from = 0;
        const ease = (t) => 1 - Math.pow(1 - t, 3);

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const value = from + (target - from) * ease(progress);
            element.textContent = `${formatWithDecimals(value, decimals)}${suffix}`;
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                element.textContent = finalText;
            }
        }

        requestAnimationFrame(tick);
    }

    function formatWithDecimals(value, decimals) {
        if (decimals === 0) {
            return String(Math.round(value));
        }
        return value.toFixed(decimals);
    }

    function renderSparkline(svgId, values, options = {}) {
        const svg = document.getElementById(svgId);
        if (!svg) return;
        const { type = 'line', color = '#7ee3c8' } = options;
        const width = 120;
        const height = 36;
        svg.innerHTML = '';

        const usable = values.filter((v) => Number.isFinite(v));
        if (!usable.length) return;

        const gradId = `spark-grad-${svgId}`;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.42"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>`;
        svg.appendChild(defs);

        const min = Math.min(...usable);
        const max = Math.max(...usable);
        const range = max - min || 1;

        if (type === 'bar') {
            const slot = width / values.length;
            const barW = Math.max(1.5, slot - 1.5);
            values.forEach((v, i) => {
                const norm = Number.isFinite(v) ? (v - min) / range : 0;
                const barH = Math.max(2, norm * (height - 2));
                const x = i * slot + (slot - barW) / 2;
                const y = height - barH;
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x.toFixed(2));
                rect.setAttribute('y', y.toFixed(2));
                rect.setAttribute('width', barW.toFixed(2));
                rect.setAttribute('height', barH.toFixed(2));
                rect.setAttribute('rx', '1');
                rect.setAttribute('fill', color);
                rect.setAttribute('opacity', '0.85');
                svg.appendChild(rect);
            });
            return;
        }

        const step = usable.length > 1 ? width / (usable.length - 1) : 0;
        const points = usable.map((v, i) => {
            const x = i * step;
            const y = height - ((v - min) / range) * (height - 4) - 2;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        });

        const lineD = 'M' + points.join(' L');
        const fillD = `${lineD} L${width.toFixed(2)},${height} L0,${height} Z`;

        const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fillPath.setAttribute('d', fillD);
        fillPath.setAttribute('fill', `url(#${gradId})`);
        svg.appendChild(fillPath);

        const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        linePath.setAttribute('d', lineD);
        linePath.setAttribute('fill', 'none');
        linePath.setAttribute('stroke', color);
        linePath.setAttribute('stroke-width', '1.6');
        linePath.setAttribute('stroke-linecap', 'round');
        linePath.setAttribute('stroke-linejoin', 'round');
        linePath.setAttribute('style', `filter: drop-shadow(0 0 4px ${color}99);`);
        svg.appendChild(linePath);
    }

    function bucketCounts(entries, bucketCount) {
        const times = entries.map((e) => e.timestampValue).filter((t) => t > 0);
        if (times.length < 2) {
            return new Array(bucketCount).fill(0).map((_, i) => (i < times.length ? 1 : 0));
        }
        const min = Math.min(...times);
        const max = Math.max(...times);
        const span = max - min || 1;
        const buckets = new Array(bucketCount).fill(0);
        for (const t of times) {
            const idx = Math.min(bucketCount - 1, Math.floor(((t - min) / span) * bucketCount));
            buckets[idx]++;
        }
        return buckets;
    }

    function cumulativeUnique(entries) {
        const ordered = entries.slice().reverse();
        const seen = new Set();
        return ordered.map((e) => {
            seen.add(e.host);
            return seen.size;
        });
    }

    function computeTrend(values) {
        const finite = values.filter((v) => Number.isFinite(v));
        if (finite.length < 4) return null;
        const mid = Math.floor(finite.length / 2);
        const older = finite.slice(0, mid);
        const recent = finite.slice(mid);
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        return { delta: recentAvg - olderAvg, olderAvg, recentAvg };
    }

    function setTrend(elementId, trend, options = {}) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (!trend) {
            el.hidden = true;
            return;
        }
        const { unit = '', decimals = 1, lowerIsBetter = false } = options;
        const abs = Math.abs(trend.delta);
        const dataDirection = trend.delta > 0.01 ? 'up' : trend.delta < -0.01 ? 'down' : 'flat';
        let semantic = 'flat';
        if (dataDirection !== 'flat') {
            semantic = lowerIsBetter
                ? (dataDirection === 'down' ? 'good' : 'bad')
                : (dataDirection === 'up'   ? 'good' : 'bad');
        }
        const arrow = dataDirection === 'up' ? '\u2191' : dataDirection === 'down' ? '\u2193' : '\u2192';
        el.className = `trend-pill ${semantic}`;
        el.textContent = `${arrow} ${abs.toFixed(decimals)}${unit}`;
        el.hidden = false;
    }

    function setOrbStatus(entries, options = {}) {
        const orb = document.getElementById('status-orb');
        if (!orb) return;
        if (options.error) {
            orb.dataset.status = 'offline';
            return;
        }
        if (!entries.length) {
            orb.dataset.status = 'loading';
            return;
        }
        const recent = entries.slice(0, Math.min(5, entries.length));
        const offlineCount = recent.filter((e) => e.status === 'offline').length;
        const lossValues = recent.map((e) => e.packetLossPct).filter((v) => Number.isFinite(v));
        const avgLoss = lossValues.length
            ? lossValues.reduce((a, b) => a + b, 0) / lossValues.length
            : 0;

        if (offlineCount >= Math.ceil(recent.length / 2)) {
            orb.dataset.status = 'offline';
        } else if (offlineCount > 0 || avgLoss > 5) {
            orb.dataset.status = 'degraded';
        } else {
            orb.dataset.status = 'nominal';
        }
    }

    function describeOrbStatus(status) {
        switch (status) {
            case 'nominal':  return 'All systems nominal';
            case 'degraded': return 'Degraded connectivity';
            case 'offline':  return 'Connection lost';
            default:         return 'Standing by';
        }
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
