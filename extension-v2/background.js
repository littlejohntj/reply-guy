// Reply Guy v2 - Background Service Worker

// Handle keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-overlay') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-overlay' });
      }
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && (tab.url?.includes('twitter.com') || tab.url?.includes('x.com'))) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggle-overlay' });
  }
});

console.log('Reply Guy v2: Background service worker loaded');
