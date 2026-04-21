// Netlify Function: /.netlify/functions/pitwall
// GET  -> returns the full championship state
// POST -> overwrites the full championship state (body is the new state as JSON)
//
// Uses Netlify Blobs — a free built-in key-value store.
// No external database, no account setup. Works automatically once deployed.

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'pitwall';
const KEY = 'state';

// The initial championship state, used on first load before anyone has saved
// anything. Kept in sync with the seed data in src/App.jsx.
const INITIAL_STATE = {
  seasons: [
    { id: 's_initial', name: 'Season 1', createdAt: 1735000000000 },
  ],
  currentSeasonId: 's_initial',
  drivers: [
    { id: 'd_mick', name: 'Mick', color: '#E10600', createdAt: 1735000000000 },
    { id: 'd_west', name: 'West', color: '#00D2BE', createdAt: 1735000000000 },
    { id: 'd_ty',   name: 'Ty',   color: '#FFC700', createdAt: 1735000000000 },
  ],
  laps: [
    { id: 'l_01', trackName: 'Australia',     driverId: 'd_mick', timeMs: 80241,  dateStr: '2025-08-26', seasonId: 's_initial', createdAt: 1735000001000 },
    { id: 'l_02', trackName: 'Belgium',       driverId: 'd_mick', timeMs: 106872, dateStr: '2025-09-02', seasonId: 's_initial', createdAt: 1735000002000 },
    { id: 'l_03', trackName: 'Great Britain', driverId: 'd_mick', timeMs: 89348,  dateStr: '2025-09-08', seasonId: 's_initial', createdAt: 1735000003000 },
    { id: 'l_04', trackName: 'Monza',         driverId: 'd_west', timeMs: 81947,  dateStr: '2025-09-24', seasonId: 's_initial', createdAt: 1735000004000 },
    { id: 'l_05', trackName: 'Netherlands',   driverId: 'd_mick', timeMs: 72687,  dateStr: '2025-09-08', seasonId: 's_initial', createdAt: 1735000005000 },
    { id: 'l_06', trackName: 'Texas',         driverId: 'd_mick', timeMs: 96877,  dateStr: '2025-08-26', seasonId: 's_initial', createdAt: 1735000006000 },
    { id: 'l_07', trackName: 'Abu Dhabi',     driverId: 'd_ty',   timeMs: 87105,  dateStr: '2025-09-08', seasonId: 's_initial', createdAt: 1735000007000 },
    { id: 'l_08', trackName: 'Azerbaijan',    driverId: 'd_ty',   timeMs: 102961, dateStr: '2025-09-02', seasonId: 's_initial', createdAt: 1735000008000 },
    { id: 'l_09', trackName: 'Hungary',       driverId: 'd_ty',   timeMs: 80082,  dateStr: '2025-09-14', seasonId: 's_initial', createdAt: 1735000009000 },
    { id: 'l_10', trackName: 'Imola',         driverId: 'd_mick', timeMs: 77783,  dateStr: '2025-09-24', seasonId: 's_initial', createdAt: 1735000010000 },
    { id: 'l_11', trackName: 'Miami',         driverId: 'd_ty',   timeMs: 90287,  dateStr: '2025-08-22', seasonId: 's_initial', createdAt: 1735000011000 },
    { id: 'l_12', trackName: 'Singapore',     driverId: 'd_ty',   timeMs: 93319,  dateStr: '2025-09-02', seasonId: 's_initial', createdAt: 1735000012000 },
    { id: 'l_13', trackName: 'Spain',         driverId: 'd_ty',   timeMs: 75470,  dateStr: '2025-08-22', seasonId: 's_initial', createdAt: 1735000013000 },
    { id: 'l_14', trackName: 'Brazil',        driverId: 'd_ty',   timeMs: 70987,  dateStr: '2025-09-14', seasonId: 's_initial', createdAt: 1735000014000 },
    { id: 'l_15', trackName: 'Japan',         driverId: 'd_west', timeMs: 92424,  dateStr: '2025-08-22', seasonId: 's_initial', createdAt: 1735000015000 },
    { id: 'l_16', trackName: 'Mexico',        driverId: 'd_west', timeMs: 78829,  dateStr: '2025-09-02', seasonId: 's_initial', createdAt: 1735000016000 },
    { id: 'l_17', trackName: 'Monaco',        driverId: 'd_west', timeMs: 75440,  dateStr: '2025-08-22', seasonId: 's_initial', createdAt: 1735000017000 },
    { id: 'l_18', trackName: 'Saudi',         driverId: 'd_west', timeMs: 92040,  dateStr: '2025-09-08', seasonId: 's_initial', createdAt: 1735000018000 },
  ],
  races: [],
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = getStore(STORE_NAME);

  try {
    if (req.method === 'GET') {
      const existing = await store.get(KEY, { type: 'json' });
      const state = existing ?? INITIAL_STATE;
      return new Response(JSON.stringify(state), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({ error: 'Invalid body' }), {
          status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      // Basic shape check — just enough to stop someone from torching the store
      const required = ['seasons', 'drivers', 'laps', 'races', 'currentSeasonId'];
      for (const field of required) {
        if (!(field in body)) {
          return new Response(JSON.stringify({ error: `Missing field: ${field}` }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
      }
      await store.setJSON(KEY, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', {
      status: 405, headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error('pitwall function error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/pitwall',
};
