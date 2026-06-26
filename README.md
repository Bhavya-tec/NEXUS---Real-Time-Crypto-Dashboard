# NEXUS — Real-Time Crypto Dashboard

A full-stack crypto trading dashboard built with **vanilla HTML/CSS/JS** on the frontend and **Node.js + Express** on the backend. Zero frontend libraries — every chart, animation, and UI component is hand-built from scratch.

![Dashboard](https://img.shields.io/badge/Status-Active-00F5A0?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2B%20Node.js%20%2B%20PostgreSQL-4E9EFF?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)

---

## Features

- **Live Market Data** — 22 crypto assets via CoinGecko public API, updated every 15 seconds
- **Custom Canvas Charts** — Hand-drawn line charts, gauge, donut, and sparklines using raw Canvas 2D API — no Chart.js, no D3
- **Demo Paper Trading** — Buy/sell with $10,000 virtual balance, real-time P&L tracking
- **JWT Authentication** — Register/login with bcrypt password hashing and 7-day JWT tokens
- **PostgreSQL Persistence** — All user data (accounts, holdings, orders) stored with full ACID transactions
- **Live News + Sentiment** — Free RSS feeds from CoinDesk, CoinTelegraph, Decrypt with keyword-based bullish/bearish scoring
- **Glass Morphism UI** — `backdrop-filter` blur cards with mouse-tracking light effect
- **Multi-page SPA** — Client-side routing with smooth page transitions, no framework
- **Scroll Reveal Animations** — IntersectionObserver-based reveal system
- **Graceful Fallback** — In-memory storage if PostgreSQL is not available

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Charts | HTML5 Canvas 2D API (hand-written) |
| Backend | Node.js, Express.js |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Database | PostgreSQL (pg) |
| News | RSS feeds (CoinDesk, CoinTelegraph, Decrypt) |
| Market Data | CoinGecko Public API (free, no key needed) |

---

## Project Structure

```
terminal/
├── index.html        # App structure — all 4 pages, modals, nav
├── style.css         # Full design system — glass UI, animations, responsive
├── script.js         # All frontend logic — state, charts, auth, trading, news
├── server.js         # Express backend — auth routes, trading API, news proxy
├── db-setup.sql      # PostgreSQL schema — users, accounts, holdings, orders
├── package.json      # Backend dependencies
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL (optional — falls back to in-memory if not available)
- Python 3 (to serve frontend locally)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/terminal.git
cd terminal
```

### 2. Install backend dependencies

```bash
npm install
```

### 3. Set up PostgreSQL (optional but recommended)

Create a database:
```bash
psql -U postgres
CREATE DATABASE terminal;
\q
```

Run the schema:
```bash
psql -U postgres -d terminal -f db-setup.sql
```

### 4. Configure environment (optional)

Create a `.env` file or set these variables before running the server:

```bash
PG_HOST=localhost
PG_PORT=5432
PG_DB=terminal
PG_USER=postgres
PG_PASSWORD=yourpassword
JWT_SECRET=your_super_secret_key_here
```

If you skip this step, the server uses default values and falls back to in-memory storage.

### 5. Start the backend

```bash
node server.js
```

You should see:
```
✓ PostgreSQL connected
TERMINAL backend → http://localhost:3001
```

### 6. Serve the frontend

In a new terminal:
```bash
python3 -m http.server 8080
```

### 7. Open in browser

```
http://localhost:8080
```

Register an account and start trading.

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with email + password |
| POST | `/api/auth/login` | Login, returns JWT token |
| GET | `/api/auth/me` | Validate token, returns user info |

### Trading (requires Bearer token)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/account` | Get balance, holdings, order history |
| POST | `/api/trade` | Place buy or sell order |
| POST | `/api/reset` | Reset account to $10,000 |

### Public
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/news` | Fetch news with sentiment scores |
| GET | `/api/health` | Server health + DB status |

---

## Architecture Decisions

**Why Vanilla JS?**
Every chart, animation, and state update is written by hand — no abstractions hiding the fundamentals. React's `useState` and render cycle are implemented manually here, which makes the underlying concepts visible and defensible.

**Why Canvas from scratch?**
Full control over rendering. Every curve (`quadraticCurveTo`), gradient fill, and glow dot is explicitly coded. No dependency on Chart.js means no black boxes in the codebase.

**Why JWT over sessions?**
Stateless auth — the server stores nothing per-user. The token carries the user ID, verified with a secret key. Scales horizontally without session sync.

**Why SQL Transactions for trades?**
Buying involves three operations: deduct balance, update holdings, record order. If any step fails mid-way, `ROLLBACK` reverts everything — account never ends up in a corrupted state.

**Single Source of Truth**
All live data lives in one `state` object in `script.js`. Every UI component reads from state, never from the DOM. State changes → `renderAll()` → screen updates. One direction, no inconsistency.

---

## Known Limitations

This is a portfolio/demo project. For production use:

- Add HTTPS
- Add API rate limiting
- Use `httpOnly` cookies instead of localStorage for JWT
- Add JWT refresh tokens
- Properly manage secrets via environment variables (not hardcoded defaults)
- Add comprehensive input sanitization
- Add logging system

---

## Screenshots

| Dashboard | Trade | News |
|---|---|---|
| Live charts + 22 assets | Buy/sell with P&L | RSS sentiment analysis |

---

## Author

**Bhavya Jain**
- GitHub: [@bhavya-tec](https://github.com/bhavya-tec)
- LinkedIn: [bhavya-jain-28a89a311](https://www.linkedin.com/in/bhavya-jain-28a89a311/)
- Email: bhavyajainfeb19@gmail.com

---

## License

MIT — free to use, modify, and distribute.
