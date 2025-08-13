import { Router } from 'express';
import { z } from 'zod';
import { store } from './store';
import { broadcastRoom, broadcastRoomDeleted } from './sockets';

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

export default router;


