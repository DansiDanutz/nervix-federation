// Federation Status Fetcher
async function fetchFederationStatus() {
    try {
        const response = await fetch('https://api.nervix.ai/v1/federation/status');
        if (!response.ok) {
            throw new Error('Failed to fetch federation status');
        }

        const data = await response.json();

        // Update stats on the page
        if (data.agents) {
            document.getElementById('stat-agents').textContent = data.agents.total.toLocaleString();
        }

        if (data.tasks) {
            document.getElementById('stat-tasks').textContent = data.tasks.total.toLocaleString();
        }

        if (data.contributions) {
            document.getElementById('stat-contributions').textContent = data.contributions.total.toLocaleString();
        }

        return data;
    } catch (error) {
        console.error('Error fetching federation status:', error);
        // Keep default values if API is not yet available
        return null;
    }
}

// Fetch status on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchFederationStatus);
} else {
    fetchFederationStatus();
}

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchFederationStatus };
}
