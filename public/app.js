document.addEventListener('DOMContentLoaded', () => {
    const pingBtn = document.getElementById('ping-btn');
    const targetInput = document.getElementById('target-input');
    const resultsGrid = document.getElementById('active-pings');
    const appStatus = document.getElementById('app-status');

    pingBtn.addEventListener('click', async () => {
        const host = targetInput.value.trim();
        if (!host) {
            showError('Please enter a valid hostname or IP');
            return;
        }

        addPingCard(host);
        targetInput.value = '';
    });

    targetInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') pingBtn.click();
    });

    function addPingCard(host) {
        const cardId = 'card-' + Date.now();
        const card = document.createElement('div');
        card.className = 'result-card animate-up';
        card.id = cardId;
        
        card.innerHTML = `
            <div class="result-header">
                <span class="result-host">${host}</span>
                <span class="close-btn" onclick="this.parentElement.parentElement.remove()">×</span>
            </div>
            <div class="latency-display">
                <div class="latency-value" id="${cardId}-latency">--</div>
                <div class="latency-unit">AVERAGE MS</div>
            </div>
            <div class="result-footer" style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #888;">
                <span id="${cardId}-status">Analyzing...</span>
                <span id="${cardId}-loss">Loss: 0%</span>
            </div>
        `;
        
        resultsGrid.prepend(card);
        simulatePing(host, cardId);
    }

    async function simulatePing(host, cardId) {
        const latencyEl = document.getElementById(`${cardId}-latency`);
        const statusEl = document.getElementById(`${cardId}-status`);
        const lossEl = document.getElementById(`${cardId}-loss`);

        // In a real app, this would be a fetch() call to a Firebase Function
        // For demonstration, we simulate the network delay and randomization
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Random simulation logic
            const isUp = !host.includes('dead') && Math.random() > 0.05;
            
            if (isUp) {
                const avgLatency = Math.floor(Math.random() * 45) + 12;
                latencyEl.textContent = avgLatency;
                latencyEl.style.color = '#00ff88';
                statusEl.textContent = 'Operational';
                statusEl.style.color = '#00ff88';
                lossEl.textContent = 'Loss: 0%';
            } else {
                latencyEl.textContent = 'TIMEOUT';
                latencyEl.style.color = '#ff4d4d';
                statusEl.textContent = 'Unreachable';
                statusEl.style.color = '#ff4d4d';
                lossEl.textContent = 'Loss: 100%';
            }
        } catch (err) {
            statusEl.textContent = 'Error';
            latencyEl.textContent = '!!!';
        }
    }

    function showError(msg) {
        appStatus.textContent = msg;
        appStatus.style.color = '#ff4d4d';
        setTimeout(() => {
            appStatus.textContent = 'Systems Nominal';
            appStatus.style.color = '';
        }, 3000);
    }
});
