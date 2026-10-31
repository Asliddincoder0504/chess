# PROJECT: WellChess
## Telegram Multiplayer Chess & Checkers Platform

Act as a senior Node.js backend engineer and full-stack JavaScript developer.

Build a complete, production-quality multiplayer Chess and Checkers platform integrated with Telegram Bot API and Telegram Mini Apps.

The application must support real online multiplayer games, ELO ratings, automatic matchmaking, user profiles, leaderboards and match history.

IMPORTANT: This project must use pure JavaScript and Node.js.

# 1. ARCHITECTURE

Use the following architecture:

A. BACKEND:
- Node.js
- JavaScript (ES Modules)
- Telegram Serverless runtime
- Telegram Bot API
- Serverless API handlers
- Native fetch API
- Pure JavaScript game engines

B. FRONTEND:
- HTML5
- CSS3
- Vanilla JavaScript
- Telegram WebApp SDK
- Responsive mobile-first interface

C. HOSTING:
- Telegram Serverless for the Telegram bot.
- GitHub Pages for frontend hosting.
- Node.js API must run using officially supported Telegram Serverless capabilities.

D. STORAGE:
- Use persistent storage officially supported by Telegram Serverless.
- Never rely on temporary runtime memory for permanent game data.
- Store users, ratings, games, moves and matchmaking data persistently.
- Verify actual storage capabilities before implementation.

STRICTLY FORBIDDEN:
- Python
- TypeScript
- React
- Next.js
- Express.js
- MongoDB
- PostgreSQL
- Redis
- Firebase
- Supabase
- External VPS
- AWS
- Permanently running backend servers
- External database servers

Do not invent unsupported Telegram Serverless APIs.

# 2. NODE.JS API

Build a modular REST-style API using the official Telegram Serverless request/handler mechanism.

Required endpoints:

USER:
GET /api/profile
GET /api/profile/stats
GET /api/profile/history

RATINGS:
GET /api/ratings/chess
GET /api/ratings/checkers
GET /api/leaderboard/chess
GET /api/leaderboard/checkers

MATCHMAKING:
POST /api/matchmaking/join
POST /api/matchmaking/cancel
GET /api/matchmaking/status

GAMES:
POST /api/game/create
GET /api/game/:id
POST /api/game/:id/move
POST /api/game/:id/resign
POST /api/game/:id/draw
POST /api/game/:id/rematch

Each endpoint must:
- Validate the request.
- Authenticate the Telegram user.
- Return consistent JSON responses.
- Handle errors.
- Check authorization.
- Prevent duplicate requests.
- Use appropriate HTTP status codes where supported.

If the Serverless runtime does not support arbitrary REST routing, implement equivalent handlers using its supported routing mechanism and document the mapping.

# 3. TELEGRAM AUTHENTICATION

Implement secure Telegram Mini App authentication.

Requirements:
- Read Telegram.WebApp.initData from frontend.
- Send initData to backend.
- Validate Telegram's cryptographic signature.
- Verify authentication date and reject expired data.
- Identify users using the verified Telegram ID.
- Never trust a Telegram ID submitted directly by frontend.
- Never expose the bot token.
- Protect all private API endpoints.

# 4. TELEGRAM BOT

Implement a Telegram bot using the official supported Telegram Serverless SDK.

Commands:

/start
/play
/profile
/rating
/leaderboard
/history
/help

Features:
- Automatic registration.
- Main menu.
- Open Mini App button.
- Player notifications.
- Match found notifications.
- Game result notifications.
- Rematch invitations.
- Game invitation links.

# 5. CHESS ENGINE

Implement complete standard chess rules.

Features:
- 8x8 board.
- Legal move validation.
- Check.
- Checkmate.
- Stalemate.
- Castling.
- En passant.
- Pawn promotion.
- Draw by repetition.
- Fifty-move rule.
- Insufficient material.
- Resignation.
- Draw offers.

Use a pure JavaScript chess library if compatible with the runtime. Otherwise implement a tested custom engine.

The backend must validate every move.

# 6. CHECKERS ENGINE

Implement international 10x10 checkers.

Features:
- 20 pieces per player.
- Mandatory captures.
- Multiple captures.
- Flying kings.
- Promotion.
- Legal move validation.
- Win detection.
- Draw detection.
- Resignation.
- Draw offers.

Keep Chess and Checkers ratings separate.

# 7. REAL-TIME MULTIPLAYER

Do not depend on WebSockets or a permanently running process.

Use serverless API requests and polling.

Requirements:
- Player A sends a move.
- Backend validates the move.
- Backend saves the updated game state.
- Player B retrieves the latest game state.
- Use game version numbers.
- Prevent simultaneous conflicting moves.
- Verify player turns.
- Use server timestamps for game clocks.
- Support reconnection.
- Support timeouts.
- Support resignation and draw offers.

The backend is always authoritative.

Implement adaptive polling to reduce unnecessary API requests.

# 8. MATCHMAKING

Create a complete matchmaking system.

Game modes:
- Chess
- Checkers

Features:
- Automatic opponent search.
- Separate queues for both games.
- Rating-based matching.
- Time control selection.
- Match cancellation.
- Queue expiration.
- Duplicate entry prevention.
- Concurrent matchmaking protection.

Initially match players within ±100 ELO.

Expand the ELO range as waiting time increases.

Do not match a player against themselves.

Use persistent storage and concurrency-safe operations supported by Telegram Serverless.

If atomic storage operations are unavailable, clearly document the limitation and implement the safest supported alternative.

# 9. ELO RATING SYSTEM

Starting ELO: 1000.

Use the standard ELO formula:

Expected score:

E = 1 / (1 + 10 ^ ((RB - RA) / 400))

New rating:

R_new = R_old + K * (S - E)

Requirements:
- Separate Chess and Checkers ELO.
- K=32 for new players.
- Configurable K factors.
- Wins.
- Losses.
- Draws.
- Rating history.
- Rating change display.
- Prevent duplicate rating updates.
- Save old and new ratings.
- Update both players consistently.

# 10. TIME CONTROLS

Support:

Bullet:
- 1+0
- 2+1

Blitz:
- 3+0
- 3+2
- 5+0

Rapid:
- 10+0
- 10+5
- 15+10

Game clocks must be calculated using authoritative server timestamps.

# 11. FRONTEND DESIGN

Create a premium gaming interface.

Design:
- Dark theme.
- Modern typography.
- Chess-inspired colors.
- Smooth animations.
- Mobile-first responsive layout.
- Telegram Mini App integration.
- Touch-friendly board.
- Clear game status indicators.

Pages:

HOME:
- Chess.
- Checkers.
- Quick Match.
- User rating.
- Online player count.

MATCHMAKING:
- Searching animation.
- Rating range.
- Search status.
- Cancel button.

GAME:
- Interactive board.
- Opponent profile.
- Player profile.
- Both ratings.
- Game clock.
- Move history.
- Resign button.
- Draw button.
- Reconnection status.

PROFILE:
- Telegram avatar.
- Username.
- Chess ELO.
- Checkers ELO.
- Wins.
- Losses.
- Draws.
- Win percentage.
- Total matches.

LEADERBOARD:
- Chess ranking.
- Checkers ranking.
- Top 100 players.
- Search players.

HISTORY:
- Previous games.
- Opponent.
- Results.
- Rating changes.
- Date.

SETTINGS:
- Sound.
- Theme.
- Language.
- Preferences.

# 12. ADMIN PANEL

Create a protected administration interface.

Features:
- User management.
- Player statistics.
- Active games.
- Match history.
- Ban and unban users.
- Suspicious activity monitoring.
- Matchmaking statistics.

Use secure server-side admin authorization.

# 13. PROJECT STRUCTURE

Create:

wellchess/
│
├── backend/
│   ├── index.js
│   ├── api/
│   │   ├── profile.js
│   │   ├── matchmaking.js
│   │   ├── games.js
│   │   ├── ratings.js
│   │   └── leaderboard.js
│   ├── bot/
│   │   ├── commands.js
│   │   ├── handlers.js
│   │   └── notifications.js
│   ├── core/
│   │   ├── chess.js
│   │   ├── checkers.js
│   │   ├── elo.js
│   │   ├── matchmaking.js
│   │   └── validation.js
│   ├── storage/
│   │   ├── users.js
│   │   ├── games.js
│   │   ├── ratings.js
│   │   └── index.js
│   └── package.json
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── chess.js
│   │   ├── checkers.js
│   │   ├── game.js
│   │   ├── matchmaking.js
│   │   └── profile.js
│   └── assets/
│
├── tests/
├── README.md
└── .gitignore

Adapt the structure to the actual Telegram Serverless deployment format.

# 14. TESTING

Write automated tests using Node.js-compatible test tools.

Test:
- Chess rules.
- Checkers rules.
- ELO calculations.
- Matchmaking.
- Concurrent game moves.
- Authentication.
- Duplicate requests.
- Game completion.
- Rating updates.
- Storage persistence.

Do not use mock functionality for production features.

# 15. DEPLOYMENT

Provide complete instructions for:

1. Creating a bot with BotFather.
2. Configuring Telegram Serverless.
3. Setting environment variables.
4. Deploying the Node.js backend.
5. Publishing frontend on GitHub Pages.
6. Configuring the Mini App URL in BotFather.
7. Connecting frontend to the backend API.
8. Testing the complete application.

Include:
- package.json.
- Required Serverless configuration.
- .env.example.
- README.md.
- Deployment commands.

# 16. FINAL DEVELOPMENT RULES

- Build actual working functionality.
- Do not create only a UI prototype.
- Do not leave core features as TODO.
- Do not invent API capabilities.
- Do not store permanent data in runtime memory.
- Do not trust frontend game states.
- Do not fake ratings or players.
- Keep all code modular.
- Use JavaScript only.
- Test each module.
- Verify integration between frontend, API and Telegram bot.

Start by examining the official Telegram Serverless documentation:

https://core.telegram.org/bots/serverless

First establish the exact supported API, storage, runtime and deployment capabilities.

Then implement the complete project phase by phase.

If Telegram Serverless cannot support an essential feature, explicitly identify the limitation. Never pretend that an unsupported feature works.

The final result must be a functional Telegram Chess and Checkers platform, not a demonstration.