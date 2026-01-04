// Reply Guy Background Service Worker

const DASHBOARD_URL = 'http://localhost:3000';

// Listen for messages from web page (via externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === 'storeReply') {
    // Store the pending reply
    chrome.storage.local.set({
      pendingReply: {
        text: message.text,
        tweetUrl: message.tweetUrl,
        timestamp: Date.now()
      }
    }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.match(/(?:twitter|x)\.com/)) {
    return;
  }

  if (command === 'add-profile') {
    const match = tab.url.match(/(?:twitter|x)\.com\/([^/?]+)/);
    if (match && !['home', 'explore', 'notifications', 'messages', 'search'].includes(match[1])) {
      const username = match[1];

      // Get display name from content script
      let displayName = username;
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileInfo' });
        displayName = result?.displayName || username;
      } catch (e) {
        console.log('Could not get display name');
      }

      // Save to storage
      const stored = await chrome.storage.local.get(['profiles']);
      const profiles = stored.profiles || [];

      if (!profiles.some(p => p.username === username)) {
        profiles.unshift({
          username,
          displayName,
          addedAt: new Date().toISOString(),
        });
        await chrome.storage.local.set({ profiles: profiles.slice(0, 50) });

        // Sync with backend
        try {
          await fetch(`${DASHBOARD_URL}/api/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, displayName }),
          });
        } catch (e) {
          console.log('Could not sync with backend');
        }

        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Profile Added',
          message: `@${username} added to Reply Guy watchlist`,
        });
      }
    }
  }

  if (command === 'quick-reply') {
    // TODO: Implement quick reply from Twitter page
    console.log('Quick reply triggered');
  }
});

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Reply Guy extension installed');
});
