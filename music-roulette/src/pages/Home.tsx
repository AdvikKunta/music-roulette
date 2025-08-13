import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type Player = { id: string; name: string; isHost: boolean };

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [flashTimer, setFlashTimer] = useState<number | null>(null);

  // Auto-redirect to the lobby if this browser already has an active session
  useEffect(() => {
    const me = JSON.parse(localStorage.getItem('mr_me') || 'null');
    if (!me?.code || !me?.playerId) return;
    (async () => {
      try {
        const res = await api.get(`/rooms/${me.code}`);
        const inRoom = (res.data?.players || []).some((p: any) => p.id === me.playerId);
        if (inRoom) navigate(`/lobby/${me.code}`);
        else {
          // session stale
          // optionally clear stale session so it doesn't keep bouncing
          // localStorage.removeItem('mr_me');
        }
      } catch {
        // room not found; ignore
      }
    })();
  }, [navigate]);

  useEffect(() => {
    // Read and clear transient flash message
    try {
      const msg = sessionStorage.getItem('mr_flash');
      if (msg) {
        setFlash(msg);
        sessionStorage.removeItem('mr_flash');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (flash) {
      const id = window.setTimeout(() => setFlash(null), 5000);
      setFlashTimer(id);
      return () => {
        if (flashTimer) window.clearTimeout(flashTimer);
        window.clearTimeout(id);
      };
    }
  }, [flash]);

  async function createRoom() {
    if (!name.trim()) return;
    const res = await api.post('/rooms', { name: name.trim() });
    const { code, player } = res.data as { code: string; player: Player };
    localStorage.setItem('mr_me', JSON.stringify({ playerId: player.id, name: player.name, code }));
    navigate(`/lobby/${code}`);
  }

  async function joinRoom() {
    if (!name.trim() || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    try {
      const res = await api.post(`/rooms/${code}/join`, { name: name.trim() });
      const { player } = res.data as { player: Player };
      localStorage.setItem('mr_me', JSON.stringify({ playerId: player.id, name: player.name, code }));
      navigate(`/lobby/${code}`);
    } catch (e: any) {
      const err = e?.response?.data?.error || 'Join failed';
      const msg = err === 'NAME_TAKEN' ? 'That name is already taken. Sucks to suck.' : err;
      setFlash(msg);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(135deg, #0f172a, #020617)' }}>
      <div style={{ maxWidth: 800, width: '100%', display: 'grid', gap: 16 }}>
        {flash && (
          <div style={{ background: 'rgba(8,145,178,0.15)', border: '1px solid #0891b2', color: '#e2e8f0', padding: '10px 12px', borderRadius: 10 }}>
            {flash}
          </div>
        )}
        <div style={{ background: 'rgba(2,6,23,0.7)', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, color: '#e2e8f0' }}>Music Roulette</h1>
          <p style={{ color: '#94a3b8', marginTop: 8 }}>Enter your name, then create a room or join with a code.</p>
          <div style={{ marginTop: 16 }}>
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 10, padding: '10px 12px' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div style={{ background: 'rgba(2,6,23,0.7)', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, color: '#e2e8f0' }}>Create Your Own Room</h2>
            <button onClick={createRoom} disabled={!name.trim()} style={{ width: '100%', background: '#0891b2', border: 'none', color: 'white', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', opacity: name.trim() ? 1 : 0.5 }}>
              Create
            </button>
          </div>
          <div style={{ background: 'rgba(2,6,23,0.7)', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, color: '#e2e8f0' }}>Join An Existing Room</h2>
            <input
              placeholder="Room Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}
            />
            <button onClick={joinRoom} disabled={!name.trim() || !joinCode.trim()} style={{ width: '100%', background: '#0891b2', border: 'none', color: 'white', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', opacity: name.trim() && joinCode.trim() ? 1 : 0.5 }}>
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


