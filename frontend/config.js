// Frontend Configuration - Dynamic API URL based on environment
const API_CONFIG = {
    // Detect if we're in production or development
    get apiBaseUrl() {
        // Check if we're running on Vercel or similar production environment
        if (typeof window !== 'undefined') {
            // Use the current origin for API calls (works for same-origin setups)
            return window.location.origin;
        }
        return 'http://localhost:5000';
    },
    
    // Helper function to get full API URL
    getApiUrl(path) {
        return `${this.apiBaseUrl}${path}`;
    },
    
    // Auth-related URLs
    get loginUrl() {
        return this.getApiUrl('/api/login');
    },
    
    get logoutUrl() {
        return this.getApiUrl('/api/logout');
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
