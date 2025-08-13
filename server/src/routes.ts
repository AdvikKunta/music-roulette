import { Router } from 'express';
import { z } from 'zod';
import { store } from './store';
import { broadcastRoom, broadcastRoomDeleted } from './sockets';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config(); // ensure env available here too (for tests or isolated imports)

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

router.post('/rooms', (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(32) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_NAME' });
  const { code, player, snapshot } = store.createRoom(parsed.data.name.trim());
  // No subscribers yet, so no broadcast here
  return res.json({ code, player, snapshot });
});

router.post('/rooms/:code/join', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const schema = z.object({ name: z.string().min(1).max(32) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_NAME' });
  try {
    const { player } = store.joinRoom(code, parsed.data.name.trim());
    broadcastRoom(code);
    return res.json({ player });
  } catch (e: any) {
    if (e.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
    if (e.message === 'NAME_TAKEN') return res.status(409).json({ error: 'NAME_TAKEN' });
    if (e.message === 'GAME_IN_PROGRESS') return res.status(403).json({ error: 'GAME_IN_PROGRESS' });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.post('/rooms/:code/kick', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const schema = z.object({ playerId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY' });
  try {
    store.kickPlayer(code, parsed.data.playerId);
    broadcastRoom(code);
    return res.json({ ok: true });
  } catch (e: any) {
    if (e.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.get('/rooms/:code', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const snap = store.snapshot(code);
  if (!snap) return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  return res.json(snap);
});

router.post('/rooms/:code/leave', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const schema = z.object({ playerId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY' });
  try {
    const result = store.leaveOrDelete(code, parsed.data.playerId);
    if (result.deleted) {
      // Inform subscribers the room is gone and clear the room group
      broadcastRoomDeleted(code);
      return res.json({ deleted: true });
    }
    broadcastRoom(code);
    return res.json({ deleted: false });
  } catch (e: any) {
    if (e.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.post('/rooms/:code/start', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const schema = z.object({ playerId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY' });
  try {
    store.startGame(code, parsed.data.playerId);
    broadcastRoom(code);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = e.message;
    if (msg === 'ROOM_NOT_FOUND') return res.status(404).json({ error: msg });
    if (msg === 'INVALID_PHASE' || msg === 'NOT_ENOUGH_PLAYERS' || msg === 'NOT_HOST') return res.status(400).json({ error: msg });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.post('/rooms/:code/config', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const schema = z.object({
    playerId: z.string().min(1),
    numSongsPerPlayer: z.number().int().min(1).max(10),
    timePerVotingRoundSeconds: z.number().int().min(0).max(300),
    numSongsToPlay: z.number().int().min(1).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY' });
  try {
    store.setNumSongs(code, parsed.data.playerId, parsed.data.numSongsPerPlayer);
    store.setVotingTime(code, parsed.data.playerId, parsed.data.timePerVotingRoundSeconds);
    store.setNumSongsToPlay(code, parsed.data.playerId, parsed.data.numSongsToPlay);
    broadcastRoom(code);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = e.message;
    if (msg === 'ROOM_NOT_FOUND') return res.status(404).json({ error: msg });
    if (msg === 'NOT_HOST') return res.status(403).json({ error: msg });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.post('/rooms/:code/submit', (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const schema = z.object({ playerId: z.string().min(1), song: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY' });
  try {
    store.submitSong(code, parsed.data.playerId, parsed.data.song);
    broadcastRoom(code);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = e.message;
    if (msg === 'ROOM_NOT_FOUND') return res.status(404).json({ error: msg });
    if (msg === 'INVALID_PHASE' || msg === 'LIMIT_REACHED' || msg === 'NOT_IN_ROOM') return res.status(400).json({ error: msg });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

// Spotify search proxy using Client Credentials flow
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'INVALID_QUERY' });
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return res.json({ items: [] }); // gracefully return empty if not configured
  }
  try {
    // fetch app token
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );
    const token = tokenRes.data.access_token as string;
    const searchRes = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${token}` },
      params: { q, type: 'track', limit: 10 },
    });
    const items = (searchRes.data?.tracks?.items || []).map((t: any) => ({
      id: t.id,
      title: t.name,
      artist: (t.artists || []).map((a: any) => a.name).join(', '),
      url: `https://open.spotify.com/track/${t.id}`,
      previewUrl: t.preview_url,
      durationMs: t.duration_ms,
      imageUrl: t.album?.images?.[0]?.url || null,
    }));
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'SPOTIFY_SEARCH_FAILED' });
  }
});

export default router;


