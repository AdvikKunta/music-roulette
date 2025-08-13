import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

type Player = { id: string; name: string; isHost: boolean };
type Room = {
  code: string;
  phase: 'lobby' | 'submitting' | 'playing' | 'ended';
  players: Player[];
  numSongsPerPlayer?: number;
  timePerVotingRoundSeconds?: number;
  numSongsToPlay?: number;
};

export default function Lobby() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Room | null>(null);
  const me = useMemo(() => JSON.parse(localStorage.getItem('mr_me') || 'null'), []);
  const leavingRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/rooms/${code}`);
        const snap = res.data as Room;
        // If this client is no longer in the room, they were kicked (or room reset)
        const stillInRoom = snap.players.some((p) => p.id === me?.playerId);
        if (!stillInRoom && !leavingRef.current) {
          try {
            sessionStorage.setItem('mr_flash', 'You have been kicked by the host.');
          } catch {}
          localStorage.removeItem('mr_me');
          navigate('/');
          return;
        }
        if (!stillInRoom && leavingRef.current) {
          // user intentionally left; go home silently
          localStorage.removeItem('mr_me');
          navigate('/');
          return;
        }
        // If already in game phases, redirect to appropriate page
        if (snap.phase === 'submitting') {
          navigate(`/submit/${code}`);
          return;
        }
        setSnapshot(snap);
      } catch {
        try { sessionStorage.setItem('mr_flash', 'Room not found or expired.'); } catch {}
        localStorage.removeItem('mr_me');
        navigate('/');
        return;
      }
    }
    load();
    const socket = getSocket();
    socket.emit('room:subscribe', { code });
    socket.on('room:state', (snap) => {
      if (snap.code !== code) return;
      const stillInRoom = snap.players.some((p: Player) => p.id === me?.playerId);
      if (!stillInRoom && !leavingRef.current) {
        try {
          sessionStorage.setItem('mr_flash', 'You have been kicked by the host.');
        } catch {}
        localStorage.removeItem('mr_me');
        navigate('/');
        return;
      }
      if (!stillInRoom && leavingRef.current) {
        // user intentionally left; no kick message
        localStorage.removeItem('mr_me');
        navigate('/');
        return;
      }
      if (snap.phase === 'submitting') {
        navigate(`/submit/${code}`);
        return;
      }
      setSnapshot(snap);
    });
    const onDisconnect = async () => {
      try {
        await api.get(`/rooms/${code}`);
      } catch {
        try { sessionStorage.setItem('mr_flash', 'Room not found or expired.'); } catch {}
        localStorage.removeItem('mr_me');
        navigate('/');
      }
    };
    socket.on('disconnect', onDisconnect);
    socket.on('room:deleted', (payload) => {
      if (payload?.code !== code) return;
      if (leavingRef.current) return; // suppress notice for the host or anyone intentionally leaving
      try {
        sessionStorage.setItem('mr_flash', 'The host left.');
      } catch {}
      localStorage.removeItem('mr_me');
      navigate('/');
    });
    return () => {
      socket.off('room:state');
      socket.off('room:deleted');
      socket.off('disconnect', onDisconnect);
    };
  }, [code, me?.playerId, navigate]);

  if (!snapshot) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ background: 'rgba(2,6,23,0.7)', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
          <p style={{ color: '#e2e8f0' }}>Room not found.</p>
          <button onClick={() => navigate('/')} style={{ background: '#0891b2', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Back home</button>
        </div>
      </div>
    );
  }

  const isHost = !!snapshot.players.find((p) => p.id === me?.playerId && p.isHost);
  const canStart = snapshot.players.length >= 3 && snapshot?.phase === 'lobby';

  function leave() {
    if (!me) return navigate('/');
    leavingRef.current = true;
    (async () => {
      try {
        await api.post(`/rooms/${code}/leave`, { playerId: me.playerId });
      } catch {
        // ignore
      } finally {
        localStorage.removeItem('mr_me');
        navigate('/');
      }
    })();
  }

  async function kick(playerId: string) {
    try {
      await api.post(`/rooms/${code}/kick`, { playerId });
      const socket = getSocket();
      socket.emit('room:broadcast', { code });
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Kick failed');
    }
  }

  function startGame() {
    if (!isHost || !canStart) return;
    (async () => {
      try {
        const songs = Number((document.getElementById('cfg-songs') as HTMLInputElement).value);
        const time = Number((document.getElementById('cfg-time') as HTMLInputElement).value);
        const total = Number((document.getElementById('cfg-total') as HTMLInputElement).value);
        await api.post(`/rooms/${code}/config`, { playerId: me.playerId, numSongsPerPlayer: songs, timePerVotingRoundSeconds: time, numSongsToPlay: total });
        await api.post(`/rooms/${code}/start`, { playerId: me.playerId });
      } catch (e: any) {
        console.error('Start failed', e?.response?.data || e);
      }
    })();
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(135deg, #0f172a, #020617)' }}>
      <div style={{ maxWidth: 640, width: '100%', background: 'rgba(2,6,23,0.7)', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, color: '#e2e8f0' }}>Lobby • {code}</h2>
          <button onClick={leave} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Leave</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ color: '#94a3b8' }}>
            You: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{me?.name || 'Unknown'}</span>
            <span style={{ marginLeft: 8, color: '#94a3b8' }}>
              {snapshot.players.some((p) => p.id === me?.playerId && p.isHost) ? '(Host)' : '(Player)'}
            </span>
          </div>
        </div>
        <div style={{ marginBottom: 16, color: '#94a3b8' }}>Waiting for players. Host can start at 3+ players.</div>
        {isHost && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ color: '#94a3b8', minWidth: 180 }}>Songs per player</label>
              <input type="number" min={1} max={10} defaultValue={snapshot?.numSongsPerPlayer || 3} id="cfg-songs" style={{ width: 120, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8, padding: '8px 10px' }} onChange={async () => {
                const songs = Number((document.getElementById('cfg-songs') as HTMLInputElement).value);
                const time = Number((document.getElementById('cfg-time') as HTMLInputElement).value);
                const total = Number((document.getElementById('cfg-total') as HTMLInputElement).value);
                await api.post(`/rooms/${code}/config`, { playerId: me.playerId, numSongsPerPlayer: songs, timePerVotingRoundSeconds: time, numSongsToPlay: total }).catch(() => {});
              }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ color: '#94a3b8', minWidth: 180 }}>Time per voting round (seconds, 0=manual)</label>
              <input type="number" min={0} max={300} defaultValue={snapshot?.timePerVotingRoundSeconds ?? 30} id="cfg-time" style={{ width: 120, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8, padding: '8px 10px' }} onChange={async () => {
                const songs = Number((document.getElementById('cfg-songs') as HTMLInputElement).value);
                const time = Number((document.getElementById('cfg-time') as HTMLInputElement).value);
                const total = Number((document.getElementById('cfg-total') as HTMLInputElement).value);
                await api.post(`/rooms/${code}/config`, { playerId: me.playerId, numSongsPerPlayer: songs, timePerVotingRoundSeconds: time, numSongsToPlay: total }).catch(() => {});
              }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ color: '#94a3b8', minWidth: 180 }}>Number of songs to play</label>
              <input type="number" min={1} max={100} defaultValue={snapshot?.numSongsToPlay ?? 10} id="cfg-total" style={{ width: 120, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8, padding: '8px 10px' }} onChange={async () => {
                const songs = Number((document.getElementById('cfg-songs') as HTMLInputElement).value);
                const time = Number((document.getElementById('cfg-time') as HTMLInputElement).value);
                const total = Number((document.getElementById('cfg-total') as HTMLInputElement).value);
                await api.post(`/rooms/${code}/config`, { playerId: me.playerId, numSongsPerPlayer: songs, timePerVotingRoundSeconds: time, numSongsToPlay: total }).catch(() => {});
              }} />
            </div>
          </div>
        )}
        {!isHost && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 16, color: '#94a3b8' }}>
            <div>Settings chosen by host:</div>
            <div>• Songs per player: <span style={{ color: '#e2e8f0' }}>{snapshot.numSongsPerPlayer ?? 3}</span></div>
            <div>• Time per voting round: <span style={{ color: '#e2e8f0' }}>{snapshot.timePerVotingRoundSeconds ?? 30}</span> sec {snapshot.timePerVotingRoundSeconds === 0 ? '(manual)' : ''}</div>
            <div>• Total songs to play: <span style={{ color: '#e2e8f0' }}>{snapshot.numSongsToPlay ?? 10}</span></div>
          </div>
        )}
        <ul style={{ display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
          {snapshot.players.map((p) => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(2,6,23,0.6)', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ color: '#e2e8f0' }}>{p.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', border: '1px solid #334155', padding: '2px 8px', borderRadius: 999 }}>{p.isHost ? 'HOST' : 'PLAYER'}</span>
                {isHost && !p.isHost && (
                  <button onClick={() => kick(p.id)} style={{ background: '#7f1d1d', color: '#fee2e2', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Kick</button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {isHost ? (
          <button onClick={startGame} disabled={!canStart} style={{ width: '100%', background: canStart ? '#0891b2' : '#334155', color: 'white', border: 'none', borderRadius: 10, padding: '10px 12px', cursor: canStart ? 'pointer' : 'not-allowed', marginTop: 16 }}>
            {snapshot?.phase !== 'lobby' ? 'Game in progress' : canStart ? 'Start Game' : 'Need 3+ players to start'}
          </button>
        ) : (
          snapshot?.phase === 'lobby' ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 16 }}>Waiting for host to start…</div>
          ) : <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 16 }}>Starting game...</div>
        )}
      </div>
    </div>
  );
}


