import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

type Player = { id: string; name: string; isHost: boolean };
type Snapshot = { code: string; phase: string; players: Player[]; numSongsPerPlayer?: number; submissionCounts: Record<string, number> };
type SearchItem = { id: string; title: string; artist: string; url: string; previewUrl: string | null; durationMs: number; imageUrl: string | null };

export default function Submissions() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const me = useMemo(() => JSON.parse(localStorage.getItem('mr_me') || 'null'), []);
  const [song, setSong] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const countMe = snap ? (snap.submissionCounts[me?.playerId] || 0) : 0;
  const limit = snap?.numSongsPerPlayer || 3;

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/rooms/${code}`);
        const s = res.data as Snapshot;
        const inRoom = s.players.some((p) => p.id === me?.playerId);
        if (!inRoom) {
          // Not part of the room → go home
          localStorage.removeItem('mr_me');
          navigate('/');
          return;
        }
        if (s.phase !== 'submitting') navigate(`/lobby/${code}`);
        else setSnap(s);
      } catch {
        navigate('/');
      }
    }
    load();
    const socket = getSocket();
    socket.emit('room:subscribe', { code });
    socket.on('room:state', (s: Snapshot) => {
      if (s.code !== code) return;
      const inRoom = s.players.some((p) => p.id === me?.playerId);
      if (!inRoom) {
        localStorage.removeItem('mr_me');
        navigate('/');
        return;
      }
      if (s.phase !== 'submitting') navigate(`/lobby/${code}`);
      else setSnap(s);
    });
    return () => {
      socket.off('room:state');
    };
  }, [code, navigate]);

  async function submit() {
    if (!song.trim()) return;
    try {
      await api.post(`/rooms/${code}/submit`, { playerId: me.playerId, song: song.trim() });
      setSong('');
    } catch (e: any) {
      console.error('submit failed', e?.response?.data || e);
    }
  }

  async function search() {
    if (!q.trim()) return;
    try {
      const res = await api.get('/search', { params: { q } });
      setResults(res.data.items || []);
    } catch (e) {
      setResults([]);
    }
  }

  async function leave() {
    try {
      await api.post(`/rooms/${code}/leave`, { playerId: me.playerId });
    } catch {
      // ignore network errors on leave
    } finally {
      localStorage.removeItem('mr_me');
      navigate('/');
    }
  }

  if (!snap) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(135deg, #0f172a, #020617)' }}>
      <div style={{ maxWidth: 720, width: '100%', background: 'rgba(2,6,23,0.7)', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>Submit your songs ({countMe}/{limit})</h2>
          <div style={{ color: '#94a3b8' }}>
            You: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{me?.name || 'Unknown'}</span>
            {snap && (
              <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                {snap.players.some((p) => p.id === me?.playerId && p.isHost) ? '(Host)' : '(Player)'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input value={song} onChange={(e) => setSong(e.target.value)} placeholder="Paste song URL or title" style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 10, padding: '10px 12px' }} />
          <button onClick={submit} disabled={countMe >= limit || !song.trim()} style={{ background: '#0891b2', color: 'white', border: 'none', borderRadius: 10, padding: '10px 12px', cursor: countMe >= limit ? 'not-allowed' : 'pointer' }}>Add</button>
          <button onClick={leave} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 10, padding: '10px 12px' }}>Leave</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Spotify: artist, title…" style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 10, padding: '10px 12px' }} />
          <button onClick={search} style={{ background: '#0891b2', color: 'white', border: 'none', borderRadius: 10, padding: '10px 12px' }}>Search</button>
        </div>
        {results.length > 0 && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {results.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(2,6,23,0.6)', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px' }}>
                {r.imageUrl && <img src={r.imageUrl} alt="cover" width={40} height={40} />}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.title}</div>
                  <div style={{ color: '#94a3b8' }}>{r.artist}</div>
                </div>
                <button onClick={() => setSong(`${r.artist} – ${r.title} (${r.url})`)} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '6px 10px' }}>Use</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, color: '#94a3b8' }}>All players must submit {limit} songs. Waiting for others…</div>
        <ul style={{ display: 'grid', gap: 6, marginTop: 12, listStyle: 'none', padding: 0 }}>
          {snap.players.map((p) => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(2,6,23,0.6)', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ color: '#e2e8f0' }}>{p.name}</span>
              <span style={{ color: '#e2e8f0' }}>{snap.submissionCounts[p.id] || 0}/{limit}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


