// Reply Guy Extension Popup

const DASHBOARD_URL = 'http://localhost:3000'; // Update for production

document.addEventListener('DOMContentLoaded', () => {
  const addProfileBtn = document.getElementById('add-profile');
  const openDashboardBtn = document.getElementById('open-dashboard');
  const statusDiv = document.getElementById('status');
  const profileList = document.getElementById('profile-list');

  // Load recent profiles
  loadRecentProfiles();

  // Add profile button
  addProfileBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Extract username from Twitter URL
      const match = tab.url.match(/(?:twitter|x)\.com\/([^/?]+)/);
      if (!match || ['home', 'explore', 'notifications', 'messages', 'search'].includes(match[1])) {
        showStatus('Navigate to a Twitter profile to add it', 'error');
        return;
      }

      const username = match[1];

      // Get profile info from the page
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileInfo' });

      // Save to storage
      const profiles = await getStoredProfiles();
      if (!profiles.some(p => p.username === username)) {
        profiles.unshift({
          username,
          displayName: result?.displayName || username,
          addedAt: new Date().toISOString(),
        });
        await chrome.storage.local.set({ profiles: profiles.slice(0, 50) });
      }

      // Send to backend
      await sendToBackend(username, result?.displayName);

      showStatus(`Added @${username} to watchlist`, 'success');
      loadRecentProfiles();
    } catch (error) {
      console.error('Error adding profile:', error);
      showStatus('Failed to add profile', 'error');
    }
  });

  // Open dashboard button
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }

  async function getStoredProfiles() {
    const result = await chrome.storage.local.get(['profiles']);
    return result.profiles || [];
  }

  async function loadRecentProfiles() {
    const profiles = await getStoredProfiles();
    profileList.innerHTML = profiles.slice(0, 5).map(p =>
      `<li>@${p.username}</li>`
    ).join('') || '<li style="color: #64748b">No profiles added yet</li>';
  }

  async function sendToBackend(username, displayName) {
    try {
      await fetch(`${DASHBOARD_URL}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      });
    } catch (error) {
      console.error('Failed to sync with backend:', error);
    }
  }
});
