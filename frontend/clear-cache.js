// Clear Cache Script
// This script ensures no service workers or cached data interferes with the app

(function() {
    'use strict';

    console.log('🔄 Cache Clearing Script Loaded');

    // 1. Unregister all service workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister().then(function(success) {
                    if (success) {
                        console.log('✅ Service Worker unregistered');
                    }
                });
            }
        });
    }

    // 2. Clear all caches
    if ('caches' in window) {
        caches.keys().then(function(names) {
            for (let name of names) {
                caches.delete(name).then(function(success) {
                    if (success) {
                        console.log('✅ Cache cleared:', name);
                    }
                });
            }
        });
    }

    // 3. Force reload from server on first load
    const hasReloaded = sessionStorage.getItem('hasReloaded');
    if (!hasReloaded) {
        console.log('🔄 First load detected, ensuring fresh content...');
        sessionStorage.setItem('hasReloaded', 'true');
        // Use setTimeout to avoid reload loop
        setTimeout(function() {
            window.location.reload(true);
        }, 100);
    }

    // 4. Clear on page unload to prevent stale state
    window.addEventListener('beforeunload', function() {
        sessionStorage.removeItem('hasReloaded');
    });

    console.log('✅ Cache Clearing Script Complete');
})();
