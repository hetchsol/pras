// API Configuration
// In production, this will point to your Render backend URL
// Change this to your actual backend URL after deployment

const CONFIG = {
  // Automatically uses localhost for development, Render URL for production
  API_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : 'https://pras-backend.onrender.com/api'
};

// Make it globally available
window.API_URL = CONFIG.API_URL;
window.CONFIG = CONFIG;
