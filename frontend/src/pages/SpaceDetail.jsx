import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useAuth } from '../api/auth.jsx';

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function SpaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [space, setSpace] = useState(null);
  const [date, setDate] = useState(today());
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ start: '10:00', end: '11:00' });
  const [msg, setMsg] = useState(null);

  useEffect(() => { api.get(`/spaces/${id}`).then(r => setSpace(r.data.data)).catch(e => setMsg({ type: 'error', text: errMsg(e) })); }, [id]);
  const loadAvail = async () => {
    try { const { data } = await api.get(`/spaces/${id}/availability`, { params: { date } }); setSlots(data.data.slots); }
    catch (e) { setMsg({ type: 'error', text: errMsg(e) }); }
  };
  useEffect(() => { loadAvail(); /* eslint-disable-next-line */ }, [id, date]);

  const book = async (e) => {
    e.preventDefault(); setMsg(null);
    if (!user) return nav('/login');
    try {
      await api.post('/bookings', { spaceId: id, date, start: form.start, end: form.end });
      setMsg({ type: 'ok', text: 'Booking requested — awaiting admin approval.' });
      loadAvail();
    } catch (e) { setMsg({ type: 'error', text: errMsg(e) }); }
  };

  if (!space) return <p>Loading…</p>;
  return (
    <section>
      <button className="btn ghost" onClick={() => nav(-1)}>← Back</button>
      <div className="row"><h1>{space.name}</h1><span className={`tag ${space.type}`}>{space.type}</span></div>
      <p className="muted">{space.description}</p>
      <p>Capacity <b>{space.capacity}</b> · ₹{space.pricePerHour}/hr</p>
      <div className="amenities">{(space.amenities || []).map(a => <span key={a} className="chip">{a}</span>)}</div>

      <div className="two-col">
        <div className="card">
          <h3>Availability</h3>
          <input type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} />
          <div className="slots">
            {slots.map(s => (
              <button key={s.start} className={`slot ${s.status}`} title={s.status}
                onClick={() => s.status === 'free' && setForm({ start: s.start, end: s.end })}>
                {s.start}
              </button>
            ))}
          </div>
          <div className="legend">
            <span className="dot free" /> free <span className="dot approved" /> approved
            <span className="dot pending" /> pending <span className="dot maintenance" /> maintenance
          </div>
        </div>

        <form className="card" onSubmit={book}>
          <h3>Book this space</h3>
          <label>Date<input type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} /></label>
          <label>Start<input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} required /></label>
          <label>End<input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} required /></label>
          <button className="btn full" type="submit">{user ? 'Request booking' : 'Login to book'}</button>
          {msg && <div className={`alert ${msg.type === 'ok' ? 'success' : 'error'}`}>{msg.text}</div>}
        </form>
      </div>
    </section>
  );
}
