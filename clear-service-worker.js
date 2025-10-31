// Run this script in Safari Console to unregister service workers
// Open Safari → Develop → Show Web Inspector → Console tab
// Copy and paste this entire script

(async function() {
  if ('serviceWorker' in navigator) {
    try {
      // Get all service worker registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      console.log(`Found ${registrations.length} service worker(s) to unregister`);
      
      // Unregister each one
      for (const registration of registrations) {
        const unregistered = await registration.unregister();
        if (unregistered) {
          console.log('✓ Service worker unregistered:', registration.scope);
        } else {
          console.log('✗ Failed to unregister:', registration.scope);
        }
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log(`Found ${cacheNames.length} cache(s) to clear`);
        
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.log('✓ Cache deleted:', cacheName);
        }
      }
      
      console.log('✓ All done! Now reload the page.');
      
    } catch (error) {
      console.error('Error:', error);
    }
  } else {
    console.log('Service workers not supported');
  }
})();

