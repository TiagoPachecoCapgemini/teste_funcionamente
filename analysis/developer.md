Technical Solution Proposal – “Plants vs. Zombies Minesweeper”

────────────────────────────────────────
1. High-level Technical Proposal
────────────────────────────────────────
Target platform
• Responsive Web App (desktop & mobile browsers) published as a PWA – zero-install, shareable link, optional “Add to Home Screen”.
• Optional native builds via Capacitor/React-Native in a future phase – out-of-scope for v1.

Technology stack
• Front-end: React + TypeScript, Vite build tool.
• Styling / Layout: Tailwind CSS + CSS-Grid for the board.
• Rendering: DOM is good enough (no canvas/WebGL required).  
• State management: React Context or Zustand – lightweight, no Redux overhead.
• Audio: Howler.js.
• Back-end (optional for v1): Serverless Node.js (AWS Lambda via API Gateway) + DynamoDB for public leaderboard.  
  – Keeps infra costs near zero, scales automatically.  
  – Can be omitted if only local storage high-scores are needed.

Why this works
• All requirements are client-side except leaderboard.  
• React + TS speeds development, guarantees maintainability, already mobile-friendly.  
• Serverless keeps us from running servers 24/7.

────────────────────────────────────────
2. Required Components / Modules
────────────────────────────────────────
Front-end
1. App Shell (PWA)  
2. Main Menu / Settings  
3. Game Engine (pure functions): board generation, reveal, flood-fill, flag/unflag, win/lose detection, first-click-safe algorithm.  
4. Board UI: grid renderer, cell component.  
5. Asset Manager: loads plant / zombie sprites + sound manifest.  
6. Audio Manager: play click, flag, win, lose SFX; background music toggle.  
7. Timer & HUD: elapsed time, remaining zombies counter, difficulty badge.  
8. Result Dialogs: Win, Lose, Confirmation.  
9. Leaderboard screen (reads from API or LocalStorage).

Back-end (optional)
1. Leaderboard API (λ functions)  
   – POST /leaderboard  → save score (with basic anti-spam token)  
   – GET  /leaderboard?difficulty=… → top N scores  

DevOps
• CI/CD GitHub Actions → build, run unit tests, deploy to Netlify/S3+CloudFront.  
• Infrastructure as Code (AWS SAM or Terraform) for the Lambda + DynamoDB table if used.

────────────────────────────────────────
3. Suggested Data Model
────────────────────────────────────────
Frontend (TypeScript)

type Difficulty = 'beginner' | 'intermediate' | 'expert';

interface GameSettings {
  rows: number;
  cols: number;
  mines: number;           // zombies
  difficulty: Difficulty;
}

interface Cell {
  row: number;
  col: number;
  isMine: boolean;         // isZombie
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;   // adjacentZombies
}

interface GameState {
  board: Cell[][];
  status: 'playing' | 'won' | 'lost';
  flagsLeft: number;
  startedAt: number;       // epoch ms
  endedAt?: number;
}

interface LeaderboardEntry {
  id: string;
  playerName: string;
  difficulty: Difficulty;
  timeMs: number;
  createdAt: string;       // ISO date
}

Back-end (DynamoDB)

PK: “LEADERBOARD#<difficulty>”  
SK: “SCORE#<epochMs>#<uuid>”  
Attributes: playerName, timeMs.

────────────────────────────────────────
4. Suggested Public APIs / Endpoints
────────────────────────────────────────
All JSON, REST-style, minimal.

GET  /api/leaderboard
Query Params:
  difficulty = beginner|intermediate|expert
  limit      = 50 (default 25)
Response 200:
  { entries: LeaderboardEntry[] }

POST /api/leaderboard
Body:
  { playerName, difficulty, timeMs }
Response 201:
  { entry: LeaderboardEntry }

Static assets (sprites, audio) are served via CDN; a versioned /assets/manifest.json lists paths and is fetched on boot.

────────────────────────────────────────
5. Implementation Plan (6–8 weeks)
────────────────────────────────────────
Week 1 – Setup
• Repo, CI/CD, linting, prettier, Vite + React + TS skeleton.  
• Tailwind config, PWA meta (icon, manifest, service-worker via Workbox).  

Week 2 – Core Game Logic
• Pure JS/TS board generator, flood-fill reveal, first-click-safe.  
• Unit tests (~100% coverage for engine).  

Week 3 – UI & Interaction
• Board renderer, click / right-click (long-press on touch).  
• HUD (timer, flags left).  
• Win/Lose detection & dialogs.  

Week 4 – Thematic Skin
• Integrate Plant / Zombie sprites, animations (CSS sprite sheet or Lottie).  
• Audio manager with PvZ SFX (ensure licensing).  
• Themed fonts, backgrounds.  

Week 5 – Difficulty & Settings
• Main menu, difficulty selector, instructions modal.  
• Persist last settings in LocalStorage.  

Week 6 – Leaderboard (optional)
• Build Lambda + DynamoDB stack.  
• Front-end leaderboard screen, score submission on win.  
• Basic validation & CORS.  

Week 7 – QA & Polish
• Cross-browser & mobile testing, 30 fps check.  
• Accessibility audit (ARIA, contrast).  
• Performance budget: initial bundle < 250 KB gzip (code-splitting, lazy asset load).  

Week 8 – Beta Release & Rollout
• Deploy on Netlify / CloudFront.  
• Collect feedback, hot-fixes, finalize v1.

────────────────────────────────────────
6. Technical Risks & Mitigations
────────────────────────────────────────
1. Licensing of Plants vs Zombies assets  
   – Use officially licensed or original fan art; confirm with legal before release.  
2. Asset size affecting load time / mobile data usage  
   – Compress PNGs/WebP, lazy-load sprites, use service-worker cache.  
3. Right-click vs touch long-press inconsistencies  
   – Add on-screen flag toggle button for mobile, fallback to double-tap.  
4. First-click-safe algorithm complexity  
   – Implement “place mines after first click” method; well-known solution.  
5. Abuse of public leaderboard (spam/cheats)  
   – Simple token (hCaptcha), time sanity checks; option to moderate or reset.  
6. Cross-browser audio autoplay restrictions  
   – Start music only after first user interaction; preload SFX quietly.  
7. Performance on low-end mobiles  
   – DOM grid with ~900 cells is fine; use memoization to avoid rerender storms.  
8. Over-scope creep (power-ups etc.)  
   – Clearly lock v1 scope to thematic reskin; log extras as backlog items.

────────────────────────────────────────
Summary
A lightweight React PWA with a tiny serverless leaderboard perfectly satisfies the stated business and functional requirements without over-engineering. The solution is inexpensive to host, easy to maintain, and can scale to any casual player traffic while offering room for future enhancements.