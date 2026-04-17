document.addEventListener('DOMContentLoaded', () => {
    const pingBtn = document.getElementById('ping-btn');
    const targetInput = document.getElementById('target-input');
    const resultsGrid = document.getElementById('active-pings');
    const appStatus = document.getElementById('app-status');
    const appStatusLabel = appStatus.querySelector('.status-label') || appStatus;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    pingBtn.addEventListener('click', () => {
        const host = targetInput.value.trim();
        if (!host) {
            flashStatus('Please enter a hostname or IP');
            return;
        }

        fireRipple(pingBtn);
        addPingCard(host);
        targetInput.value = '';
    });

    targetInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') pingBtn.click();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== targetInput) {
            e.preventDefault();
            targetInput.focus();
            targetInput.select();
        }
    });

    pingBtn.addEventListener('pointermove', (e) => {
        const rect = pingBtn.getBoundingClientRect();
        pingBtn.style.setProperty('--x', `${e.clientX - rect.left}px`);
        pingBtn.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });

    function fireRipple(btn) {
        if (prefersReducedMotion) return;
        btn.classList.remove('firing');
        void btn.offsetWidth;
        btn.classList.add('firing');
        setTimeout(() => btn.classList.remove('firing'), 720);
    }

    function addPingCard(host) {
        const cardId = 'card-' + Date.now();
        const card = document.createElement('div');
        card.className = 'result-card animate-up';
        card.id = cardId;

        const safeHost = escapeHtml(host);
        card.innerHTML = `
            <div class="result-header">
                <span class="result-host">${safeHost}</span>
                <span class="close-btn" role="button" aria-label="Dismiss result">\u00D7</span>
            </div>
            <div class="latency-display">
                <div class="latency-value" id="${cardId}-latency">--</div>
                <span class="latency-unit">Average ms</span>
            </div>
            <div class="result-footer">
                <span id="${cardId}-status">Analyzing...</span>
                <span id="${cardId}-loss">Loss: --</span>
            </div>
        `;

        card.querySelector('.close-btn').addEventListener('click', () => card.remove());
        resultsGrid.prepend(card);
        simulatePing(host, cardId);
    }

    async function simulatePing(host, cardId) {
        const latencyEl = document.getElementById(`${cardId}-latency`);
        const statusEl = document.getElementById(`${cardId}-status`);
        const lossEl = document.getElementById(`${cardId}-loss`);

        try {
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const isUp = !host.includes('dead') && Math.random() > 0.05;

            if (isUp) {
                const avgLatency = Math.floor(Math.random() * 45) + 12;
                countUp(latencyEl, avgLatency, { decimals: 0 });
                latencyEl.style.color = '';
                statusEl.textContent = 'Operational';
                statusEl.style.color = 'var(--highlight-strong)';
                lossEl.textContent = 'Loss: 0%';
            } else {
                latencyEl.textContent = 'Timeout';
                latencyEl.style.color = 'var(--danger)';
                statusEl.textContent = 'Unreachable';
                statusEl.style.color = 'var(--danger)';
                lossEl.textContent = 'Loss: 100%';
            }
        } catch (err) {
            statusEl.textContent = 'Error';
            latencyEl.textContent = '!!!';
        }
    }

    function countUp(element, target, options = {}) {
        const { decimals = 0, suffix = '', duration = 900 } = options;

        if (prefersReducedMotion || !Number.isFinite(target)) {
            element.textContent = formatValue(target, decimals) + suffix;
            return;
        }

        const start = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3);

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const value = target * ease(progress);
            element.textContent = formatValue(value, decimals) + suffix;
            if (progress < 1) requestAnimationFrame(tick);
            else element.textContent = formatValue(target, decimals) + suffix;
        }

        requestAnimationFrame(tick);
    }

    function formatValue(v, decimals) {
        return decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
    }

    function flashStatus(message) {
        const originalLabel = appStatusLabel.textContent;
        const dot = appStatus.querySelector('.status-dot');
        appStatusLabel.textContent = message;
        appStatus.style.color = 'var(--danger)';
        appStatus.style.borderColor = 'rgba(255, 123, 123, 0.35)';
        appStatus.style.background = 'rgba(255, 123, 123, 0.08)';
        if (dot) dot.style.animation = 'none';
        setTimeout(() => {
            appStatusLabel.textContent = originalLabel;
            appStatus.style.color = '';
            appStatus.style.borderColor = '';
            appStatus.style.background = '';
            if (dot) dot.style.animation = '';
        }, 2600);
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }
});
