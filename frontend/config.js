// API Configuration
// In production, this will point to your Render backend URL
// Change this to your actual backend URL after deployment

const CONFIG = {
  // For local development
  // API_URL: 'http://localhost:3001/api'

  // For production - UPDATE THIS after deploying backend to Render
  API_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : 'https://pras-backend.onrender.com/api'  // UPDATE THIS with your actual Render backend URL
};

// Make it globally available
window.API_URL = CONFIG.API_URL;
window.CONFIG = CONFIG;
