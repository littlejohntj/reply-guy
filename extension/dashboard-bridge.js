// Reply Guy Dashboard Bridge
// This content script runs on localhost:3000 and bridges data to chrome.storage

(function() {
  'use strict';

  // Watch for pending reply in localStorage
  function checkForPendingReply() {
    const pending = localStorage.getItem('replyGuyPending');
    if (pending) {
      try {
        const data = JSON.parse(pending);

        // Only process if recent (within last 5 seconds)
        if (Date.now() - data.timestamp < 5000) {
          // Store in chrome.storage for the Twitter content script to read
          chrome.storage.local.set({
            pendingReply: {
              text: data.text,
              tweetUrl: data.tweetUrl,
              timestamp: data.timestamp
            }
          }, () => {
            console.log('Reply Guy: Stored pending reply for Twitter');
          });
        }

        // Clear it
        localStorage.removeItem('replyGuyPending');
      } catch (e) {
        console.error('Reply Guy: Error parsing pending reply', e);
      }
    }
  }

  // Check immediately and on storage changes
  checkForPendingReply();

  // Listen for storage events (in case the React app writes after we check)
  window.addEventListener('storage', (e) => {
    if (e.key === 'replyGuyPending') {
      checkForPendingReply();
    }
  });

  // Also poll briefly since storage event doesn't fire for same-tab changes
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    checkForPendingReply();
    pollCount++;
    if (pollCount > 10) {
      clearInterval(pollInterval);
    }
  }, 200);

  // Listen for custom events from the React app
  window.addEventListener('replyGuyStoreReply', (e) => {
    const detail = e.detail;
    if (detail?.text) {
      chrome.storage.local.set({
        pendingReply: {
          text: detail.text,
          tweetUrl: detail.tweetUrl,
          timestamp: Date.now()
        }
      });
    }
  });

  console.log('Reply Guy: Dashboard bridge loaded');
})();
