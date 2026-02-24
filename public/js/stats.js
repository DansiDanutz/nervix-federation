/**
 * Real-time stats from Nervix API
 * No fake numbers - only actual data
 *
 * NOTE: API is currently running locally at localhost:3001
 * For production, deploy the API and update API_BASE to the public URL
 */

const API_BASE = 'http://localhost:3001/v1';
const API_PUBLIC_URL = 'https://nervix-public.vercel.app/api/v1'; // TODO: Deploy API

// Cache settings
const CACHE_KEY = 'nervix_stats';
const CACHE_TTL = 60 * 1000; // 1 minute

async function fetchWithCache(key, fetcher) {
    try {
        const cached = JSON.parse(localStorage.getItem(key) || '{}');

        if (cached.timestamp && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }

        const data = await fetcher();

        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data
        }));

        return data;
    } catch (error) {
        console.error('Cache fetch error:', error);
        const cached = JSON.parse(localStorage.getItem(key) || '{}');
        return cached.data || null;
    }
}

async function getAgentStats() {
    return fetchWithCache('nervix_agents', async () => {
        const response = await fetch(`${API_BASE}/agents`);
        if (!response.ok) throw new Error('API unreachable');
        const data = await response.json();

        return {
            total: data.agents?.length || 0,
            online: data.agents?.filter(a => a.status === 'online').length || 0,
            active: data.agents?.filter(a => a.lastActive > Date.now() - 3600000).length || 0
        };
    });
}

async function getTaskStats() {
    return fetchWithCache('nervix_tasks', async () => {
        const response = await fetch(`${API_BASE}/tasks`);
        if (!response.ok) throw new Error('API unreachable');
        const data = await response.json();

        return {
            total: data.tasks?.length || 0,
            available: data.tasks?.filter(t => t.status === 'available').length || 0,
            completed: data.tasks?.filter(t => t.status === 'completed').length || 0,
            inProgress: data.tasks?.filter(t => t.status === 'claimed').length || 0
        };
    });
}

async function getContributionStats() {
    return fetchWithCache('nervix_contributions', async () => {
        const response = await fetch(`${API_BASE}/tasks`);
        if (!response.ok) throw new Error('API unreachable');
        const data = await response.json();

        let submissions = 0;
        data.tasks?.forEach(task => {
            if (task.submissions) {
                submissions += task.submissions.length;
            }
        });

        return { total: submissions };
    });
}

async function updateStats() {
    // Show loading state
    document.getElementById('stat-agents').textContent = '...';
    document.getElementById('stat-tasks').textContent = '...';
    document.getElementById('stat-contributions').textContent = '...';

    try {
        const [agents, tasks, contributions] = await Promise.all([
            getAgentStats(),
            getTaskStats(),
            getContributionStats()
        ]);

        document.getElementById('stat-agents').textContent = agents.total;
        document.getElementById('stat-tasks').textContent = tasks.completed;
        document.getElementById('stat-contributions').textContent = contributions.total;

        // Update status indicator
        const statusIndicator = document.getElementById('api-status');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator online';
            statusIndicator.textContent = 'Live';
        }

    } catch (error) {
        console.error('Stats update error:', error);

        // Check if this is a CORS/network error (API not accessible from web)
        if (error.message && error.message.includes('Failed to fetch')) {
            document.getElementById('stat-agents').textContent = 'N/A';
            document.getElementById('stat-tasks').textContent = 'N/A';
            document.getElementById('stat-contributions').textContent = 'N/A';

            const statusIndicator = document.getElementById('api-status');
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator offline';
                statusIndicator.innerHTML = '<a href="#api-note">API Local Only</a>';
            }
        } else {
            // Show API offline
            const statusIndicator = document.getElementById('api-status');
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator offline';
                statusIndicator.textContent = 'API Offline';
            }

            // Show zero stats when API is offline
            document.getElementById('stat-agents').textContent = '0';
            document.getElementById('stat-tasks').textContent = '0';
            document.getElementById('stat-contributions').textContent = '0';
        }
    }
}

// Update stats on page load
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    setInterval(updateStats, 60000); // Update every minute
});
