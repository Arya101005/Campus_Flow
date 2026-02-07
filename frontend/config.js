// Frontend Configuration - Dynamic API URL based on environment
const API_CONFIG = {
    // Get API base URL dynamically
    getApiBaseUrl: function() {
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }
        return 'http://localhost:5000';
    },
    
    // Helper function to get full API URL
    getApiUrl: function(path) {
        return this.getApiBaseUrl() + path;
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
