// Reply Guy v2 - Twitter Overlay
(function() {
  'use strict';

  // State
  let overlayActive = false;
  let replyOptions = [];
  let selectedReplyIndex = 0;
  let generating = false;
  let panelPosition = 'right'; // 'left' or 'right'

  // API endpoint for reply generation
  const API_BASE = 'http://localhost:3000';

  // Tweet tracking - use Map for O(1) lookups by ID
  const tweetMap = new Map(); // tweetId -> tweet data
  let tweetOrder = []; // Array of tweetIds in navigation order
  let currentTweetId = null; // Track position by ID, not index

  // Create overlay elements
  const overlay = document.createElement('div');
  overlay.id = 'reply-guy-overlay';
  overlay.innerHTML = `
    <div class="rg-panel">
      <div class="rg-header">
        <div class="rg-header-left">
          <span class="rg-title">⚡ Reply Guy</span>
          <span class="rg-position">0 / 0</span>
        </div>
        <div class="rg-header-right">
          <button class="rg-position-toggle" title="Toggle position (P)">◧</button>
          <button class="rg-close" title="Close (Esc)">&times;</button>
        </div>
      </div>
      <div class="rg-tweet-content">
        <div class="rg-author"></div>
        <div class="rg-text"></div>
        <div class="rg-metrics"></div>
      </div>
      <div class="rg-reply-section">
        <div class="rg-reply-options"></div>
        <div class="rg-loading" style="display: none;">
          <div class="rg-spinner"></div>
          <span>Generating replies...</span>
        </div>
        <textarea class="rg-reply-input" placeholder="Write your reply or press G to generate..."></textarea>
      </div>
      <div class="rg-actions">
        <button class="rg-btn rg-generate">
          <span class="rg-btn-text">✨ Generate (G)</span>
        </button>
        <button class="rg-btn rg-skip">Skip (S)</button>
        <button class="rg-btn rg-reply">Reply (R)</button>
      </div>
      <div class="rg-shortcuts">
        J/K nav • G generate • V cycle • R reply • S skip • F refresh • Esc close
      </div>
      <div class="rg-status"></div>
    </div>
  `;

  // Show status message
  function showStatus(message, type = 'info') {
    const status = overlay.querySelector('.rg-status');
    status.textContent = message;
    status.className = `rg-status rg-status-${type}`;
    status.style.display = 'block';

    if (type !== 'error') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }

  // Toggle panel position
  function togglePosition() {
    panelPosition = panelPosition === 'right' ? 'left' : 'right';
    overlay.className = `rg-position-${panelPosition}`;
    showStatus(`Panel moved to ${panelPosition}`, 'info');
  }

  // Helper to get current index in navigation order
  function getCurrentIndex() {
    if (!currentTweetId) return 0;
    const idx = tweetOrder.indexOf(currentTweetId);
    return idx >= 0 ? idx : 0;
  }

  // Helper to get current tweet
  function getCurrentTweet() {
    return currentTweetId ? tweetMap.get(currentTweetId) : null;
  }

  // Parse a tweet element into data
  function parseTweetElement(el) {
    const linkEl = el.querySelector('a[href*="/status/"]');
    const tweetId = linkEl?.href?.match(/\/status\/(\d+)/)?.[1];
    if (!tweetId) return null;

    const authorEl = el.querySelector('[data-testid="User-Name"]');
    const textEl = el.querySelector('[data-testid="tweetText"]');
    const timeEl = el.querySelector('time');

    return {
      element: el,
      tweetId,
      author: authorEl?.textContent || 'Unknown',
      handle: linkEl?.href?.match(/\/([^/]+)\/status/)?.[1] || '',
      text: textEl?.textContent || '',
      url: linkEl?.href || '',
      time: timeEl?.getAttribute('datetime') || '',
      timestamp: timeEl ? new Date(timeEl.getAttribute('datetime')).getTime() : 0,
      likes: el.querySelector('[data-testid="like"] span')?.textContent || '0',
      retweets: el.querySelector('[data-testid="retweet"] span')?.textContent || '0',
      skipped: false,
    };
  }

  // Find all tweet articles on the page
  function findTweets(showMessage = true) {
    const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
    const elementsArray = Array.from(tweetElements);

    // Track DOM positions for ordering
    const domOrder = []; // tweetIds in current DOM order
    let newCount = 0;

    elementsArray.forEach((el) => {
      const tweet = parseTweetElement(el);
      if (!tweet) return;

      domOrder.push(tweet.tweetId);

      if (tweetMap.has(tweet.tweetId)) {
        // Already tracked - just update element reference (handles virtualization)
        const existing = tweetMap.get(tweet.tweetId);
        existing.element = el;
      } else {
        // New tweet!
        tweetMap.set(tweet.tweetId, tweet);
        newCount++;
      }
    });

    // Smart ordering: merge DOM order with our existing order
    // New tweets at top of DOM → prepend
    // New tweets at bottom of DOM → append
    if (newCount > 0 && domOrder.length > 0) {
      const newTweetIds = domOrder.filter(id => !tweetOrder.includes(id));

      if (newTweetIds.length > 0) {
        // Check if new tweets are at top or bottom of DOM
        const firstNewInDom = domOrder.indexOf(newTweetIds[0]);
        const lastKnownInDom = domOrder.findIndex(id => tweetOrder.includes(id));

        if (lastKnownInDom === -1 || firstNewInDom < lastKnownInDom) {
          // New tweets at top - prepend
          tweetOrder = [...newTweetIds, ...tweetOrder];
        } else {
          // New tweets at bottom - append
          tweetOrder = [...tweetOrder, ...newTweetIds];
        }
      }
    } else if (tweetOrder.length === 0) {
      // First scan - use DOM order
      tweetOrder = [...domOrder];
    }

    // Set initial position if needed
    if (!currentTweetId && tweetOrder.length > 0) {
      currentTweetId = tweetOrder[0];
    }

    if (showMessage) {
      if (newCount > 0) {
        showStatus(`+${newCount} tweets (${tweetOrder.length} total)`, 'success');
      } else if (tweetOrder.length === 0) {
        showStatus('No tweets found', 'info');
      }
    }

    return tweetOrder.length;
  }

  // Check for "Show new posts" button
  function checkForNewPostsButton() {
    const buttons = document.querySelectorAll('[role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('show') && (text.includes('post') || text.includes('tweet'))) {
        return btn;
      }
    }
    return null;
  }

  // Watch for new tweets being loaded
  let tweetObserver = null;
  let observerDebounce = null;

  function startWatchingForTweets() {
    if (tweetObserver) return;

    tweetObserver = new MutationObserver(() => {
      // Debounce to avoid excessive scanning
      if (observerDebounce) clearTimeout(observerDebounce);
      observerDebounce = setTimeout(() => {
        const oldCount = tweetOrder.length;
        findTweets(false);

        // Update panel if count changed
        if (tweetOrder.length !== oldCount) {
          updatePanel();
        }

        // Check for "Show new posts" button
        const newPostsBtn = checkForNewPostsButton();
        if (newPostsBtn) {
          showStatus('New posts available - click banner or press F', 'info');
        }
      }, 300);
    });

    // Watch the main timeline container
    const timeline = document.querySelector('[data-testid="primaryColumn"]') || document.body;
    tweetObserver.observe(timeline, { childList: true, subtree: true });
  }

  function stopWatchingForTweets() {
    if (tweetObserver) {
      tweetObserver.disconnect();
      tweetObserver = null;
    }
    if (observerDebounce) {
      clearTimeout(observerDebounce);
      observerDebounce = null;
    }
  }

  // Highlight current tweet
  function highlightTweet() {
    // Remove previous highlight
    document.querySelectorAll('.rg-highlighted').forEach(el => {
      el.classList.remove('rg-highlighted');
    });

    const tweet = getCurrentTweet();
    if (tweet?.element) {
      tweet.element.classList.add('rg-highlighted');
      tweet.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    updatePanel();
  }

  // Update the panel with current tweet info
  function updatePanel() {
    const tweet = getCurrentTweet();
    const idx = getCurrentIndex();

    const position = overlay.querySelector('.rg-position');
    const author = overlay.querySelector('.rg-author');
    const text = overlay.querySelector('.rg-text');
    const metrics = overlay.querySelector('.rg-metrics');

    position.textContent = `${idx + 1} / ${tweetOrder.length}`;

    if (tweet) {
      author.innerHTML = `<strong>@${tweet.handle}</strong> ${tweet.author.replace('@' + tweet.handle, '')}`;
      text.textContent = tweet.text || '(No text content)';
      metrics.textContent = `❤️ ${tweet.likes} • 🔁 ${tweet.retweets}`;
    } else {
      author.textContent = 'No tweet selected';
      text.textContent = '';
      metrics.textContent = '';
    }
  }

  // Set loading state
  function setLoading(loading) {
    const loadingEl = overlay.querySelector('.rg-loading');
    const textarea = overlay.querySelector('.rg-reply-input');
    const generateBtn = overlay.querySelector('.rg-generate');

    if (loading) {
      loadingEl.style.display = 'flex';
      textarea.style.display = 'none';
      generateBtn.disabled = true;
      generateBtn.querySelector('.rg-btn-text').textContent = '⏳ Generating...';
    } else {
      loadingEl.style.display = 'none';
      textarea.style.display = 'block';
      generateBtn.disabled = false;
      generateBtn.querySelector('.rg-btn-text').textContent = '✨ Generate (G)';
    }
  }

  // Generate reply options
  async function generateReplies() {
    const tweet = getCurrentTweet();
    if (generating || !tweet) return;

    if (!tweet.text) {
      showStatus('No tweet text to reply to', 'error');
      return;
    }

    generating = true;
    setLoading(true);
    showStatus('Generating replies...', 'info');

    try {
      console.log('Reply Guy: Generating for:', tweet.text.substring(0, 50));

      const res = await fetch(`${API_BASE}/api/reply/generate-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweet: tweet.text,
          authorHandle: tweet.handle,
          count: 3
        })
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      console.log('Reply Guy: Got response:', data);

      replyOptions = data.replies || (data.reply ? [data.reply] : []);

      if (replyOptions.length === 0) {
        throw new Error('No replies generated');
      }

      selectedReplyIndex = 0;
      updateReplyOptions();

      // Set first reply in textarea
      const textarea = overlay.querySelector('.rg-reply-input');
      textarea.value = replyOptions[0] || '';

      showStatus(`Generated ${replyOptions.length} reply options!`, 'success');
    } catch (err) {
      console.error('Reply Guy: Generate error', err);
      showStatus(`Error: ${err.message}. Is localhost:3000 running?`, 'error');
    } finally {
      generating = false;
      setLoading(false);
    }
  }

  // Update reply options display
  function updateReplyOptions() {
    const optionsEl = overlay.querySelector('.rg-reply-options');

    if (replyOptions.length <= 1) {
      optionsEl.innerHTML = '';
      return;
    }

    optionsEl.innerHTML = replyOptions.map((_, i) =>
      `<button class="rg-option ${i === selectedReplyIndex ? 'active' : ''}" data-index="${i}">
        Option ${i + 1}
      </button>`
    ).join('') + '<span class="rg-cycle-hint">Press V to cycle</span>';

    // Add click handlers
    optionsEl.querySelectorAll('.rg-option').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedReplyIndex = parseInt(btn.dataset.index);
        updateReplyOptions();
        overlay.querySelector('.rg-reply-input').value = replyOptions[selectedReplyIndex];
      });
    });
  }

  // Cycle through reply options
  function cycleReply() {
    if (replyOptions.length <= 1) {
      showStatus('Generate replies first (G)', 'info');
      return;
    }
    selectedReplyIndex = (selectedReplyIndex + 1) % replyOptions.length;
    updateReplyOptions();
    overlay.querySelector('.rg-reply-input').value = replyOptions[selectedReplyIndex];
    showStatus(`Option ${selectedReplyIndex + 1} of ${replyOptions.length}`, 'info');
  }

  // Click into tweet (client-side nav) and inject reply
  async function openReply() {
    const textarea = overlay.querySelector('.rg-reply-input');
    const replyText = textarea.value.trim();

    if (!replyText) {
      showStatus('Write or generate a reply first', 'error');
      return;
    }

    const tweet = getCurrentTweet();
    if (!tweet?.element) {
      showStatus('Could not find tweet', 'error');
      return;
    }

    // Copy to clipboard first
    try {
      await navigator.clipboard.writeText(replyText);
    } catch (e) {
      showStatus('Failed to copy to clipboard', 'error');
      return;
    }

    showStatus('Opening tweet...', 'info');

    // Find the tweet text area and click it (should trigger SPA navigation)
    // Clicking the actual text content triggers Twitter's internal routing
    const tweetText = tweet.element.querySelector('[data-testid="tweetText"]');
    if (tweetText) {
      tweetText.click();
    } else {
      // Try clicking the tweet content area
      const tweetContent = tweet.element.querySelector('article') || tweet.element;
      tweetContent.click();
    }

    // Wait for Twitter to do client-side navigation and render the status page
    await new Promise(r => setTimeout(r, 1500));

    // Now find the reply box on the status page
    const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (!tweetBox) {
      showStatus('Reply copied - click reply box & Cmd+V', 'info');
      return;
    }

    const editor = tweetBox.querySelector('[contenteditable="true"]') || tweetBox;

    // Click on the reply box
    editor.click();
    await new Promise(r => setTimeout(r, 300));
    editor.focus();
    await new Promise(r => setTimeout(r, 200));

    // Try to insert text using execCommand (may fail on Twitter)
    let success = document.execCommand('insertText', false, replyText);

    if (!success) {
      // execCommand failed, use paste server if available
      try {
        const pasteRes = await fetch('http://localhost:8765/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: replyText, delay: 0.15 })
        });
        success = pasteRes.ok;
      } catch (e) {
        console.log('Reply Guy: Paste server not available');
      }
    }

    if (success) {
      // Wait for Twitter to register the text
      await new Promise(r => setTimeout(r, 800));

      // Click the Reply button
      const replyBtn = document.querySelector('[data-testid="tweetButtonInline"]') ||
                       document.querySelector('[data-testid="tweetButton"]');

      if (replyBtn && !replyBtn.disabled) {
        replyBtn.click();
        showStatus('Reply sent! Going back...', 'success');

        // Go back to the feed
        await new Promise(r => setTimeout(r, 1200));
        history.back();

        // Wait for feed to load, then re-highlight current tweet
        await new Promise(r => setTimeout(r, 800));
        findTweets(false);
        highlightTweet();
      } else {
        showStatus('Reply ready! Click Reply to send.', 'success');
      }
    } else {
      showStatus('Reply copied - Cmd+V to paste', 'info');
    }
  }

  // Skip current tweet
  function skipTweet() {
    const tweet = getCurrentTweet();
    const idx = getCurrentIndex();

    // Mark as skipped visually and in data
    if (tweet) {
      tweet.skipped = true;
      if (tweet.element) {
        tweet.element.classList.add('rg-skipped');
      }
    }

    // Move to next
    if (idx < tweetOrder.length - 1) {
      currentTweetId = tweetOrder[idx + 1];
      highlightTweet();
      showStatus(`Skipped. Now on ${idx + 2}/${tweetOrder.length}`, 'info');
    } else {
      showStatus('No more tweets! Press F to scan for more.', 'info');
    }

    // Reset reply state
    replyOptions = [];
    selectedReplyIndex = 0;
    updateReplyOptions();
    overlay.querySelector('.rg-reply-input').value = '';
  }

  // Navigate tweets
  function navigate(direction) {
    const idx = getCurrentIndex();
    const newIndex = idx + direction;

    if (newIndex >= 0 && newIndex < tweetOrder.length) {
      currentTweetId = tweetOrder[newIndex];
      highlightTweet();

      // Reset reply state when navigating
      replyOptions = [];
      selectedReplyIndex = 0;
      updateReplyOptions();
      overlay.querySelector('.rg-reply-input').value = '';
    } else if (direction > 0) {
      showStatus('At the last tweet - press F to scan for more', 'info');
    } else {
      showStatus('At the first tweet', 'info');
    }
  }

  // Toggle overlay
  function toggleOverlay() {
    overlayActive = !overlayActive;

    if (overlayActive) {
      overlay.className = `rg-position-${panelPosition}`;
      document.body.appendChild(overlay);

      // Reset state
      tweetMap.clear();
      tweetOrder = [];
      currentTweetId = null;

      findTweets();
      startWatchingForTweets();

      if (tweetOrder.length > 0) {
        currentTweetId = tweetOrder[0];
        highlightTweet();
      }
    } else {
      stopWatchingForTweets();
      overlay.remove();
      document.querySelectorAll('.rg-highlighted, .rg-skipped').forEach(el => {
        el.classList.remove('rg-highlighted', 'rg-skipped');
      });
    }
  }

  // Keyboard handler
  function handleKeydown(e) {
    // Global toggle: Ctrl+Shift+R or Alt+Shift+R
    if ((e.ctrlKey || e.altKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      e.stopPropagation();
      toggleOverlay();
      return;
    }

    if (!overlayActive) return;

    // Don't capture if typing in textarea (except Escape)
    const isTyping = e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable');
    if (isTyping && e.key !== 'Escape') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'escape':
        e.preventDefault();
        toggleOverlay();
        break;
      case 'j':
      case 'arrowdown':
        e.preventDefault();
        navigate(1);
        break;
      case 'k':
      case 'arrowup':
        e.preventDefault();
        navigate(-1);
        break;
      case 'g':
        e.preventDefault();
        generateReplies();
        break;
      case 'v':
        e.preventDefault();
        cycleReply();
        break;
      case 'r':
        e.preventDefault();
        openReply();
        break;
      case 's':
        e.preventDefault();
        skipTweet();
        break;
      case 'p':
        e.preventDefault();
        togglePosition();
        break;
      case 'f':
        e.preventDefault();
        const oldCount = tweetOrder.length;
        findTweets();
        const newCount = tweetOrder.length - oldCount;
        if (newCount > 0) {
          showStatus(`+${newCount} new tweets (${tweetOrder.length} total)`, 'success');
        } else {
          showStatus(`No new tweets (${tweetOrder.length} total)`, 'info');
        }
        updatePanel();
        break;
    }
  }

  // Event listeners
  document.addEventListener('keydown', handleKeydown, true);

  // Close button
  overlay.querySelector('.rg-close').addEventListener('click', toggleOverlay);
  overlay.querySelector('.rg-position-toggle').addEventListener('click', togglePosition);

  // Button handlers
  overlay.querySelector('.rg-generate').addEventListener('click', generateReplies);
  overlay.querySelector('.rg-skip').addEventListener('click', skipTweet);
  overlay.querySelector('.rg-reply').addEventListener('click', openReply);

  // Listen for extension command
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggle-overlay') {
      toggleOverlay();
    }
  });

  console.log('Reply Guy v2: Ready! Press Ctrl+Shift+R or click extension icon to activate.');
})();
