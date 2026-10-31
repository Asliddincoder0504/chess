/**
 * WellChess Vector SVG Icons
 * Premium, crisp icons replacing emojis across the entire UI.
 */

export const ICONS = {
  // Brand Logo / Chess Icon
  logo: `
    <svg class="ui-icon icon-logo" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.5 22h-6a2 2 0 0 1-2-2c0-3.5 2-5 3-7 1-2 1-3.5 0-5.5-.5-1-1.5-1.5-2.5-1.5 1-2 3-3 6.5-3 4.5 0 7 2.5 7 6.5 0 2-.5 3-1.5 4.5 2 1.5 3.5 4 3.5 8a2 2 0 0 1-2 2h-6.5"/>
      <circle cx="10" cy="7" r="1" fill="currentColor"/>
    </svg>
  `,

  // Trophy / Achievement
  trophy: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/>
      <path d="M6 4h12v6c0 3.31-2.69 6-6 6s-6-2.69-6-6V4z"/>
    </svg>
  `,

  // Game Type: Chess
  chess: `
    <svg class="ui-icon icon-game-chess" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 20h14"/>
      <path d="M7 20v-2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2"/>
      <path d="M9 15V9h6v6"/>
      <path d="M8 9V6h2v1.5h1.5V6h1V7.5H14V6h2v3H8z"/>
    </svg>
  `,

  // Game Type: Checkers
  checkers: `
    <svg class="ui-icon icon-game-checkers" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="5" stroke-dasharray="2 2"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  `,

  // Lightning / Quick Play
  lightning: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  `,

  // Crossed Swords for Duel / Matchmaking
  swords: `
    <svg class="ui-icon icon-swords" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <line x1="16" y1="16" x2="20" y2="20"/>
      <line x1="19" y1="21" x2="21" y2="19"/>
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
      <line x1="5" y1="14" x2="9" y2="18"/>
      <line x1="7" y1="17" x2="3" y2="21"/>
      <line x1="2" y1="19" x2="4" y2="21"/>
    </svg>
  `,

  // Navigation: Home
  home: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  `,

  // Navigation: Leaderboard / Podium
  podium: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 20V10a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v10"/>
      <path d="M14 20V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v15"/>
      <path d="M10 20v-7a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v7"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  `,

  // Navigation: History
  history: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <polyline points="3 3 3 8 8 8"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
  `,

  // Navigation: User Profile
  user: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  `,

  // Navigation: Admin Shield
  shield: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  `,

  // Search Magnifying Glass
  search: `
    <svg class="ui-icon icon-search" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  `,

  // Medals for Top 1, 2, 3
  medalGold: `
    <svg class="ui-icon medal-svg gold" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <circle cx="12" cy="14" r="7" fill="#ffd700" stroke="#b89700" stroke-width="1.5"/>
      <polygon points="12,10 13.2,13 16.5,13.2 14,15.2 14.8,18.5 12,16.8 9.2,18.5 10,15.2 7.5,13.2 10.8,13" fill="#b89700"/>
      <path d="M8.5 3L12 8L15.5 3" stroke="#e63946" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  medalSilver: `
    <svg class="ui-icon medal-svg silver" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <circle cx="12" cy="14" r="7" fill="#e0e0e0" stroke="#9e9e9e" stroke-width="1.5"/>
      <polygon points="12,10 13.2,13 16.5,13.2 14,15.2 14.8,18.5 12,16.8 9.2,18.5 10,15.2 7.5,13.2 10.8,13" fill="#9e9e9e"/>
      <path d="M8.5 3L12 8L15.5 3" stroke="#457b9d" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  medalBronze: `
    <svg class="ui-icon medal-svg bronze" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <circle cx="12" cy="14" r="7" fill="#cd7f32" stroke="#8b4513" stroke-width="1.5"/>
      <polygon points="12,10 13.2,13 16.5,13.2 14,15.2 14.8,18.5 12,16.8 9.2,18.5 10,15.2 7.5,13.2 10.8,13" fill="#8b4513"/>
      <path d="M8.5 3L12 8L15.5 3" stroke="#2a9d8f" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  // Actions: Rematch
  rematch: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  `,

  // Actions: Flag / Resign
  flag: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  `,

  // Actions: Handshake / Draw
  handshake: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/>
      <path d="M13 9h-2a2 2 0 1 0 0 4h3c.6 0 1.1-.2 1.4-.6L21 7"/>
      <path d="M7 11l4-4"/>
      <path d="M17 13l-4 4"/>
    </svg>
  `,

  // Game Type: Checkers 8x8 (12 pieces)
  checkers8: `
    <svg class="ui-icon icon-game-checkers8" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
      <circle cx="16" cy="8" r="2.5" fill="none"/>
      <circle cx="8" cy="16" r="2.5" fill="none"/>
      <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
    </svg>
  `,

  // Play with Friend (Users icon)
  friends: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  `,

  // Link / Share
  link: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  `,

  // Copy icon
  copy: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  `,

  // Live / Broadcast / Eye icon
  live: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `,

  // Spectate icon
  spectate: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `,

  // Challenge / Swords mini icon
  challenge: `
    <svg class="ui-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
    </svg>
  `
};
