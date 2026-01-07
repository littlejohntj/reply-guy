# Reply Guy ⚡

A keyboard-driven Twitter/X engagement tool that helps you craft authentic replies at speed. Navigate your timeline, generate AI-powered reply suggestions, and engage — all without touching your mouse.

![Reply Guy](https://img.shields.io/badge/version-2.0.0-blue) ![License](https://img.shields.io/badge/license-ISC-green)

## What is this?

Reply Guy is a Chrome extension + local server combo that overlays on Twitter/X. It lets you:

- **Navigate tweets** with J/K keys (like Vim)
- **Generate reply options** using Claude AI
- **Train your voice** by analyzing any Twitter account's style
- **Track engagement** with a local database of tweets you've seen

The goal isn't to spam — it's to help you engage more authentically and efficiently with your timeline.

## ✨ Features

### 🎯 Keyboard-First Navigation
- `J` / `K` — Navigate down/up through tweets
- `G` — Generate 3 reply options
- `V` — Cycle through generated options
- `E` — Generate variations of current reply
- `T` — Refine reply with custom feedback
- `R` — Post the reply
- `S` — Skip tweet (move to next)
- `I` — Like current tweet
- `B` — Recenter on current tweet
- `M` — Jump to nearest visible tweet
- `P` — Toggle panel position (left/right)
- `Esc` — Close overlay

### 🤖 AI-Powered Replies
- Generates short, punchy one-liners (under 15 words)
- Matches the vibe — casual, witty, not "thought leader brain"
- Considers **quote tweet context** when present
- Analyzes **images in tweets** using Claude's vision capability
- Supports custom voice profiles trained on real accounts

### 🎭 Voice Profiles
Train the AI to write like anyone:
1. Enter a Twitter handle
2. The system analyzes their last 500 tweets
3. Creates a voice profile capturing their style (not opinions)
4. All future replies match that voice

### 💾 Tweet Database
Automatically stores every tweet you see while scrolling:
- Track what you've replied to vs skipped
- Build context for future features (theme detection, original tweet generation)
- Local SQLite database — your data stays yours

### 🖼️ Image Understanding
When a tweet contains images:
- Automatically extracts and sends to Claude Vision
- AI considers both text AND visual content
- Sessions persist so you don't re-upload images for variations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+ (for paste server)
- Chrome browser
- API keys:
  - [Anthropic API key](https://console.anthropic.com/) (for Claude)
  - [ScrapeCreators API key](https://scrapecreators.com/) (for tweet fetching)
  - [Supabase](https://supabase.com/) project (for voice profiles)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/reply-guy.git
cd reply-guy
npm install
```

### 2. Configure Environment

Create `.env.local` in the project root:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# For tweet fetching (voice profile training)
SCRAPECREATORS_API_KEY=your_key_here

# For voice profiles storage
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Set Up Paste Server (Optional but Recommended)

The paste server enables automatic text injection into Twitter's reply box:

```bash
cd paste-server
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Load the Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension-v2` folder

### 5. Start the Services

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start paste server (optional)
cd paste-server
source venv/bin/activate
python server.py
```

### 6. Use It!

1. Go to [twitter.com](https://twitter.com) or [x.com](https://x.com)
2. Press `Alt+Shift+R` (or click the extension icon)
3. Navigate with `J`/`K`, generate with `G`, reply with `R`

## 📁 Project Structure

```
reply-guy/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/
│   │   │   ├── reply/          # Reply generation endpoints
│   │   │   ├── tweets/         # Tweet storage & stats
│   │   │   └── voice-profiles/ # Voice training
│   │   └── page.tsx            # Web dashboard
│   ├── lib/
│   │   ├── claude.ts           # Claude AI integration
│   │   ├── sqlite.ts           # Local tweet database
│   │   └── sessions.ts         # Per-tweet session management
│   └── types/
├── extension-v2/               # Chrome extension
│   ├── manifest.json
│   ├── content.js              # Main overlay logic
│   ├── overlay.css             # Styling
│   └── background.js           # Service worker
├── paste-server/               # Python paste automation
│   ├── server.py
│   └── requirements.txt
└── data/                       # SQLite database (gitignored)
```

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reply/generate-direct` | POST | Generate replies (supports images) |
| `/api/reply/variations` | POST | Generate variations of a reply |
| `/api/reply/refine` | POST | Refine reply with feedback |
| `/api/tweets/store` | POST | Store discovered tweets |
| `/api/tweets/stats` | GET | Get tweet statistics |
| `/api/voice-profiles` | GET/POST | Manage voice profiles |
| `/api/voice-profiles/analyze` | POST | Train new voice profile |
| `/api/voice-profiles/activate` | POST | Set active voice |

## 🎨 Customization

### Changing the Reply Style

Edit the system prompt in `src/lib/claude.ts`. The default encourages:
- One-liners under 15 words
- Casual, friend-like tone
- Matching the original tweet's energy
- No "thought leader" speak

### Database Location

By default, tweets are stored in `data/tweets.db`. Override with:

```env
SQLITE_DB_PATH=/custom/path/tweets.db
```

## 🐛 Troubleshooting

### "No tweet text to reply to"
- Make sure you've reloaded the extension after code changes
- Check the browser console for parsing errors
- Try refreshing Twitter and re-opening the overlay

### Replies not auto-pasting
- Ensure the paste server is running on port 8765
- Check that `http://localhost:8765/health` returns OK
- Twitter's Draft.js editor is finicky — worst case, it copies to clipboard

### Extension not appearing
- Verify the extension is loaded in `chrome://extensions/`
- Check that you're on twitter.com or x.com
- Try `Alt+Shift+R` or click the extension icon

## 🛣️ Roadmap

- [ ] Original tweet generation based on timeline themes
- [ ] Scheduled posting
- [ ] Analytics dashboard
- [ ] Multi-account support
- [ ] Firefox extension

## 📄 License

ISC

---

Built for scrollers who want to engage, not just lurk. ⚡
