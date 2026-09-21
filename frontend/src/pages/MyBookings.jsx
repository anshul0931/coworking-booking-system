import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';

const fmt = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ');

export default function MyBookings() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try { const { data } = await api.get('/bookings/my', { params: status ? { status } : {} }); setRows(data.data); }
    catch (e) { setMsg(errMsg(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const cancel = async (id) => {
    setMsg('');
    try { await api.patch(`/bookings/${id}/cancel`); load(); } catch (e) { setMsg(errMsg(e)); }
  };

  return (
    <section>
      <h1>My bookings</h1>
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {['pending', 'approved', 'rejected', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {msg && <div className="alert error">{msg}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Space</th><th>Date</th><th>Slot</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map(b => (
              <tr key={b._id}>
                <td>{b.space?.name}</td><td>{b.date}</td>
                <td>{fmt(b.startAt).slice(11)} – {fmt(b.endAt).slice(11)}</td>
                <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                <td>{['pending', 'approved'].includes(b.status) && new Date(b.startAt) > new Date() &&
                  <button className="btn ghost" onClick={() => cancel(b._id)}>Cancel</button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="5">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
