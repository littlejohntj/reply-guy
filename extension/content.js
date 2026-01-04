// Reply Guy Content Script - Runs on Twitter/X

(function() {
  'use strict';

  console.log('Reply Guy: Content script loaded on', window.location.href);

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProfileInfo') {
      const displayName = document.querySelector('[data-testid="UserName"] span')?.textContent;
      sendResponse({ displayName });
    }

    if (request.action === 'injectReply') {
      injectReplyText(request.text);
      sendResponse({ success: true });
    }

    return true;
  });

  // Inject reply text into the reply composer - try multiple methods
  function injectReplyText(text) {
    console.log('Reply Guy: Attempting to inject text:', text.substring(0, 50) + '...');

    // Find the contenteditable div inside the tweet textarea
    const replyBox = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (!replyBox) {
      console.log('Reply Guy: Could not find reply box');
      return false;
    }

    // Find the actual editable element
    const editor = replyBox.querySelector('[contenteditable="true"]') ||
                   replyBox.querySelector('[role="textbox"]') ||
                   replyBox;

    console.log('Reply Guy: Found editor element:', editor.tagName, editor.className);

    // Focus the element
    editor.focus();

    // Method 1: Use execCommand (works in many cases)
    try {
      const success = document.execCommand('insertText', false, text);
      if (success) {
        console.log('Reply Guy: execCommand succeeded');
        return true;
      }
    } catch (e) {
      console.log('Reply Guy: execCommand failed', e);
    }

    // Method 2: Set innerHTML and dispatch events
    try {
      // For Twitter's DraftJS editor
      const span = document.createElement('span');
      span.setAttribute('data-text', 'true');
      span.textContent = text;

      // Find or create the text container
      let textContainer = editor.querySelector('[data-text="true"]');
      if (textContainer) {
        textContainer.textContent = text;
      } else {
        editor.innerHTML = '';
        editor.appendChild(span);
      }

      // Dispatch input event
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      // Also dispatch a 'beforeinput' event
      editor.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      console.log('Reply Guy: Direct injection attempted');
      return true;
    } catch (e) {
      console.log('Reply Guy: Direct injection failed', e);
    }

    // Method 3: Simulate keyboard input
    try {
      for (const char of text) {
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      }
      console.log('Reply Guy: Keyboard simulation attempted');
      return true;
    } catch (e) {
      console.log('Reply Guy: Keyboard simulation failed', e);
    }

    return false;
  }

  // Click the Reply/Post button to send the tweet
  async function clickSendButton() {
    // Try multiple times as the button may need time to become enabled
    for (let attempt = 0; attempt < 10; attempt++) {
      // Look for the tweet/reply button in the composer
      const tweetButton = document.querySelector('[data-testid="tweetButton"]') ||
                          document.querySelector('[data-testid="tweetButtonInline"]');

      if (tweetButton) {
        // Check if button is enabled (not disabled)
        const isDisabled = tweetButton.hasAttribute('disabled') ||
                           tweetButton.getAttribute('aria-disabled') === 'true' ||
                           tweetButton.classList.contains('r-icoktb'); // Twitter's disabled class

        if (!isDisabled) {
          console.log('Reply Guy: Clicking send button');
          tweetButton.click();
          return true;
        }
      }

      // Wait and try again
      await sleep(200);
    }

    console.log('Reply Guy: Could not find enabled send button');
    return false;
  }

  // Check for #replyguy hash and auto-open reply with text
  async function checkForReplyGuyHash() {
    const hash = window.location.hash;
    console.log('Reply Guy: Checking hash:', hash);

    if (hash === '#replyguy') {
      console.log('Reply Guy: Hash detected, starting reply flow');

      // Remove hash to clean up URL
      history.replaceState(null, '', window.location.pathname + window.location.search);

      // Mark that we're in reply mode (for auto-close)
      window.replyGuyMode = true;

      // Get pending reply from storage
      const stored = await chrome.storage.local.get(['pendingReply']);
      const pendingReply = stored.pendingReply;
      console.log('Reply Guy: Pending reply from storage:', pendingReply);

      if (!pendingReply?.text) {
        console.log('Reply Guy: No pending reply found in storage');
        showToast('No reply text found. Copy from clipboard.');
        return;
      }

      // Clear the pending reply
      await chrome.storage.local.remove(['pendingReply']);

      // Wait for page to load, then click reply button
      waitForElement('[data-testid="reply"]', async (replyButton) => {
        console.log('Reply Guy: Found reply button, clicking');
        replyButton.click();

        // Wait for reply textarea to appear
        waitForElement('[data-testid="tweetTextarea_0"]', async (textarea) => {
          console.log('Reply Guy: Found textarea');
          textarea.focus();

          // Longer delay to ensure the editor is fully ready
          await sleep(500);

          const success = injectReplyText(pendingReply.text);
          console.log('Reply Guy: Injection result:', success);

          if (success) {
            showToast('Sending reply...');

            // Wait a moment for Twitter to register the text, then click send
            await sleep(300);
            const sent = await clickSendButton();

            if (sent) {
              showToast('Reply sent! Closing...');
              setTimeout(() => window.close(), 1200);
            } else {
              showToast('Reply inserted! Click Reply to send.');
              watchForReplySent();
            }
          } else {
            // Fallback: copy to clipboard
            try {
              await navigator.clipboard.writeText(pendingReply.text);
              showToast('Auto-paste failed. Press Cmd+V to paste.');
            } catch (e) {
              showToast('Reply in clipboard - paste with Cmd+V');
            }
          }
        }, 100); // More attempts for textarea
      }, 50); // More attempts for reply button
    }
  }

  // Watch for reply being sent and close tab
  function watchForReplySent() {
    const checkForSend = () => {
      // Look for all possible tweet/reply buttons
      const buttons = document.querySelectorAll('[data-testid="tweetButton"], [data-testid="tweetButtonInline"], [role="button"]');

      buttons.forEach(button => {
        if (button.textContent?.toLowerCase().includes('reply') ||
            button.textContent?.toLowerCase().includes('post') ||
            button.getAttribute('data-testid')?.includes('tweet')) {
          button.addEventListener('click', () => {
            setTimeout(() => {
              if (window.replyGuyMode) {
                showToast('Reply sent! Closing...');
                setTimeout(() => window.close(), 800);
              }
            }, 500);
          }, { once: true });
        }
      });
    };

    checkForSend();

    const observer = new MutationObserver(checkForSend);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForElement(selector, callback, maxAttempts = 50) {
    let attempts = 0;
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 100);
      } else {
        console.log('Reply Guy: Element not found after max attempts:', selector);
      }
    };
    check();
  }

  function showToast(message) {
    const existing = document.getElementById('reply-guy-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'reply-guy-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      font-family: -apple-system, sans-serif;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: reply-guy-toast-in 0.3s ease;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'reply-guy-toast-out 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes reply-guy-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes reply-guy-toast-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
  `;
  document.head.appendChild(style);

  // Profile tracking badge
  async function checkIfTrackedProfile() {
    const match = window.location.pathname.match(/^\/([^/?]+)$/);
    if (!match) return;

    const username = match[1];
    const result = await chrome.storage.local.get(['profiles']);
    const profiles = result.profiles || [];

    if (profiles.some(p => p.username?.toLowerCase() === username.toLowerCase())) {
      addTrackedBadge();
    } else {
      removeTrackedBadge();
    }
  }

  function addTrackedBadge() {
    if (document.getElementById('reply-guy-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'reply-guy-badge';
    badge.innerHTML = '👀 Tracking';
    badge.style.cssText = `
      position: fixed; top: 60px; right: 20px;
      background: #3b82f6; color: white;
      padding: 6px 12px; border-radius: 20px;
      font-size: 13px; font-weight: 500;
      z-index: 9999; font-family: -apple-system, sans-serif;
    `;
    document.body.appendChild(badge);
  }

  function removeTrackedBadge() {
    document.getElementById('reply-guy-badge')?.remove();
  }

  // Watch for URL changes (Twitter is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkIfTrackedProfile();
      setTimeout(checkForReplyGuyHash, 300);
    }
  }).observe(document.body, { subtree: true, childList: true });

  // Initial checks
  checkIfTrackedProfile();
  setTimeout(checkForReplyGuyHash, 800);
})();
