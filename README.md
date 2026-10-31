# WellChess ♟️🏆
### Telegram Multiplayer Chess & Checkers Platform

WellChess is a production-quality, real-time multiplayer gaming platform for Telegram, built with pure **JavaScript (ES Modules)** and **Node.js**. It features authoritative game engines for standard 8x8 FIDE Chess and International 10x10 Checkers (Draughts), FIDE-compliant ELO ratings, expanding-window matchmaking, Telegram Mini App integration, and official **Telegram Serverless** deployment.

---

## 🌟 Highlights & Features

- **Authoritative Pure JavaScript Game Engines:**
  - **Chess (8x8):** Legal move generation, check/checkmate, stalemate, castling (kingside & queenside with check-path prevention), en passant, pawn promotions (Q, R, B, N), fifty-move rule, threefold repetition, and insufficient material draws.
  - **International Checkers (10x10):** 50 dark playable squares with standard 1–50 notation, 20 pieces per side, backwards capture for men, mandatory captures, maximum capture rule (majority rule), multi-jumps, and promotion to Flying Kings that slide along diagonals.
- **Cryptographic Telegram Mini App Authentication:** Validates Telegram `initData` HMAC-SHA256 signatures and checks `auth_date` expiration timestamps.
- **Zero Prohibited Dependencies:** Built with pure Node.js standard libraries (`node:crypto`, `node:http`, `node:test`). No Express, TypeScript, Python, MongoDB, PostgreSQL, Redis, Firebase, or external VPS servers.
- **Real-Time Multiplayer without WebSockets:** Serverless turn synchronization with monotonic version numbers, race-condition protection, authoritative server clocks, and adaptive polling.
- **FIDE ELO Rating System:** Starting ELO of 1000, separate rating ladders for Chess and Checkers, dynamic K-factors (K=32 provisional, K=24 standard, K=16 master), and win/loss/draw tracking.
- **Dynamic Matchmaking:** Queue with automated pairing within initial ±100 ELO, expanding by ±50 ELO every 10 seconds of queue time.
- **Premium Frontend:** Mobile-first responsive Telegram Mini App interface with dark luxury theme, inlined SVG vector pieces (zero network delay), Web Audio API sound synthesis, and touch/click move inputs.
- **Admin Panel:** Protected interface for viewing platform statistics, live active games, matchmaking queues, and user ban/unban management.

---

## 📁 Project Structure

```text
wellchess/
├── tgcloud.jsonc                     # Telegram Serverless CLI configuration
├── schema.js                         # Official Telegram Serverless SQLite schema (sdk/db)
├── package.json                      # ES Module scripts and configuration
├── .env.example                      # Environment variables template
├── .gitignore
├── README.md
│
├── backend/
│   ├── index.js                      # Universal API dispatcher & auth verification
│   ├── server.js                     # Native Node.js HTTP server (for local dev & GitHub Pages API)
│   ├── api/
│   │   ├── profile.js                # /api/profile, /api/profile/stats, /api/profile/history
│   │   ├── matchmaking.js            # /api/matchmaking/join, /cancel, /status, /stats
│   │   ├── games.js                  # /api/game/:id, /move, /resign, /draw, /rematch
│   │   ├── ratings.js                # /api/ratings/chess, /api/ratings/checkers
│   │   ├── leaderboard.js            # /api/leaderboard/chess, /api/leaderboard/checkers
│   │   └── admin.js                  # /api/admin/stats, /users, /ban, /games
│   ├── bot/
│   │   ├── commands.js               # /start, /play, /profile, /rating, /leaderboard, /help
│   │   ├── handlers.js               # Telegram updates router (messages, callback queries)
│   │   └── notifications.js          # Bot notification sender
│   ├── core/
│   │   ├── chess.js                  # Authoritative FIDE 8x8 Chess engine
│   │   ├── checkers.js               # Authoritative International 10x10 Checkers engine
│   │   ├── elo.js                    # FIDE ELO calculation system
│   │   ├── matchmaking.js            # Expanding window matchmaking engine
│   │   └── validation.js             # Telegram HMAC-SHA256 validator & time controls
│   └── storage/
│       ├── users.js                  # User profile and stats repository
│       ├── games.js                  # Game state and move log repository
│       ├── ratings.js                # ELO history repository
│       ├── matchmaking.js            # Queue repository
│       └── index.js                  # Dual-mode SQLite adapter (tgcloud sdk/db + local fallback)
│
├── tgcloud/
│   ├── handlers/
│   │   ├── message.js                # Telegram Serverless bot message handler
│   │   └── callback_query.js         # Telegram Serverless callback handler
│   └── endpoints/
│       ├── profile.js                # Serverless endpoint for profile
│       ├── matchmaking.js            # Serverless endpoint for matchmaking
│       ├── game.js                   # Serverless endpoint for game actions
│       ├── leaderboard.js            # Serverless endpoint for leaderboard
│       ├── ratings.js                # Serverless endpoint for ratings
│       └── admin.js                  # Serverless endpoint for admin
│
├── frontend/
│   ├── index.html                    # Mini App single-page application
│   ├── css/
│   │   └── style.css                 # Dark luxury theme & responsive styling
│   ├── js/
│   │   ├── app.js                    # Mini App view router & SDK initialization
│   │   ├── api.js                    # Dual-mode client (Serverless.call + fetch)
│   │   ├── chess.js                  # Client-side 8x8 chessboard renderer
│   │   ├── checkers.js               # Client-side 10x10 checkers board renderer
│   │   ├── game.js                   # Game controller, timers, sound effects
│   │   ├── matchmaking.js            # Radar search UI controller
│   │   └── profile.js                # Profile, leaderboard, history, admin UI
│   └── assets/
│       └── pieces.js                 # Inlined vector SVG pieces for Chess & Checkers
│
└── tests/
    ├── runner.js                     # Cross-platform automated test runner
    ├── elo.test.js                   # ELO calculation unit tests
    ├── chess.test.js                 # FIDE chess rules verification tests
    ├── checkers.test.js              # International 10x10 draughts rules tests
    ├── auth.test.js                  # Telegram initData cryptographic validation tests
    ├── matchmaking.test.js           # Matchmaking pairing and expanding window tests
    ├── game_flow.test.js             # Concurrency, clocks, timeouts, resignation tests
    └── storage.test.js               # Persistence & CRUD tests
```

---

## 🚀 Running Locally

### 1. Requirements
- Node.js v18+ or v20+ (ES Modules supported natively)
- No external databases or npm packages required.

### 2. Run Automated Tests
```bash
npm test
```
All 46 automated tests will execute and verify chess rules, checkers rules, ELO math, matchmaking pairing, HMAC signatures, and concurrency protection.

### 3. Run Standalone Development Server
```bash
npm start
```
Starts the built-in HTTP server at `http://localhost:3000`. You can open `http://localhost:3000` in any web browser to test the entire interface and gameplay directly.

---

## 📦 Deployment Instructions

### Step 1: Create a Bot with BotFather
1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a bot name and username (e.g. `WellChessBot`).
3. Save the generated **Bot Token** (e.g., `7123456789:AAH...`).

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
```env
BOT_TOKEN=7123456789:AAH...
MINI_APP_URL=https://<your-username>.github.io/wellchess/
ADMIN_IDS=123456789
```

### Step 3: Deploy Backend to Telegram Serverless (`tgcloud`)
Telegram Serverless runs your Node.js handlers and built-in SQLite database natively on Telegram infrastructure.

1. Ensure the `tgcloud` CLI is available:
   ```bash
   npx tgcloud login
   ```
2. Deploy the database schema migrations:
   ```bash
   npm run migrate
   # or: npx tgcloud migrate
   ```
3. Push your code modules, bot handlers, and serverless endpoints:
   ```bash
   npm run push
   # or: npx tgcloud push
   ```
4. Set the bot webhook to point to your Telegram Serverless instance:
   Telegram Serverless routes incoming bot updates directly to `tgcloud/handlers/message.js` and `tgcloud/handlers/callback_query.js`.

### Step 4: Host Frontend on GitHub Pages
1. Push your repository to GitHub.
2. In your repository on GitHub, navigate to **Settings** > **Pages**.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` (or your default branch)
   - Folder: `/frontend` (or root if using GitHub Pages root deployment)
4. Click **Save**. GitHub Pages will provide a live HTTPS URL:
   `https://<your-username>.github.io/<repository-name>/`

### Step 5: Configure the Telegram Mini App in BotFather
1. In [@BotFather](https://t.me/BotFather), send `/newapp`.
2. Select your bot (`@WellChessBot`).
3. Set Title: `WellChess`.
4. Set Description: `Multiplayer Chess and Checkers on Telegram`.
5. When asked for the Web App URL, enter your GitHub Pages URL (or your `tgcloud.ai` app URL):
   `https://<your-username>.github.io/<repository-name>/`
6. Choose a short name for your app (e.g. `play`).
7. BotFather will provide the direct Mini App link:
   `https://t.me/WellChessBot/play`

### Step 6: Connect Frontend to Backend
- If running on **Telegram Serverless**, the Mini App automatically invokes endpoints using `Telegram.WebApp.Serverless.call(endpoint, payload)`.
- If running on **GitHub Pages**, `frontend/js/api.js` automatically passes `Telegram.WebApp.initData` in the `Authorization: tma <initData>` header to your backend API. If you host the backend on a custom endpoint or tgcloud proxy, set `window.WELLCHESS_API_URL = 'https://<your-backend-domain>'` in `frontend/index.html`.

---

## ♟️ Game Rules Implemented

### Chess (FIDE Standard)
- Full 8x8 algebraic coordinate tracking (`a1`–`h8`).
- Castling rights preserved and revoked upon King/Rook movement or capture.
- Castling blocked when King is in check, or when passing through attacked squares.
- En passant pawn capture with expiration after one half-move.
- Pawn promotion with Queen, Rook, Bishop, and Knight selection.
- Authoritative Check, Checkmate, and Stalemate evaluation.
- Fifty-move rule and Threefold repetition draws.
- Insufficient material detection (K vs K, K+B vs K, K+N vs K, K+B vs K+B same color).

### Checkers (International 10x10 Draughts)
- Official 10x10 board with 50 dark playable squares (standard 1–50 numbering).
- 20 pieces per player (White occupies squares 31–50, Black occupies squares 1–20).
- Men move diagonally forward 1 square.
- **Backwards Capture:** Men capture both diagonally forward and backward.
- **Mandatory Capture:** If any capture is available, the player must capture.
- **Maximum Capture Rule:** The player must choose the sequence capturing the highest number of pieces.
- **Multi-Jumps:** Full multi-jump chain traversal in a single turn.
- **Flying Kings:** Promoted on baseline; Kings slide any distance along diagonals and jump over pieces from any distance.
- Win by piece elimination or blocking all opponent moves.

---

## 🧪 Verification & Test Suite

The test suite contains 46 comprehensive tests covering:
```text
✔ Auth cryptographic verification (HMAC-SHA256, expiration, tampering)
✔ FIDE Chess rules (all piece mechanics, castling, en passant, promotion, mate)
✔ International Checkers rules (1-50 squares, backwards captures, max capture, flying kings)
✔ ELO calculations (expected scores, K-factors, ratings floor, win/draw/loss deltas)
✔ Matchmaking queue (entry, tolerance expansion, pairing, color assignment)
✔ Concurrency and state synchronization (monotonic versioning, clocks, timeouts)
✔ Persistent storage CRUD operations
```

Execute tests at any time with:
```bash
npm test
```
