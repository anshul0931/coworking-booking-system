import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';

const empty = { name: '', type: 'desk', capacity: 1, amenities: '', description: '', pricePerHour: 0 };

export default function AdminDashboard() {
  const [tab, setTab] = useState('bookings');
  const [spaces, setSpaces] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState({ status: 'pending', date: '', spaceId: '' });
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [mt, setMt] = useState({ spaceId: '', date: '', start: '09:00', end: '11:00' });
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };
  const loadSpaces = async () => setSpaces((await api.get('/spaces', { params: { limit: 50 } })).data.data);
  const loadBookings = async () => {
    const params = {}; Object.entries(filter).forEach(([k, v]) => v && (params[k] = v));
    setBookings((await api.get('/bookings', { params })).data.data);
  };
  useEffect(() => { loadSpaces().catch(e => flash('error', errMsg(e))); }, []);
  useEffect(() => { loadBookings().catch(e => flash('error', errMsg(e))); /* eslint-disable-next-line */ }, [filter]);

  const saveSpace = async (e) => {
    e.preventDefault();
    const payload = { ...form, capacity: Number(form.capacity), pricePerHour: Number(form.pricePerHour), amenities: form.amenities ? form.amenities.split(',').map(s => s.trim()) : [] };
    try {
      if (editId) await api.put(`/spaces/${editId}`, payload); else await api.post('/spaces', payload);
      setForm(empty); setEditId(null); loadSpaces(); flash('ok', 'Space saved');
    } catch (e) { flash('error', errMsg(e)); }
  };
  const edit = (s) => { setEditId(s._id); setForm({ ...s, amenities: (s.amenities || []).join(', ') }); setTab('spaces'); };
  const del = async (id) => { if (!confirm('Delete this space?')) return; try { await api.delete(`/spaces/${id}`); loadSpaces(); flash('ok', 'Deleted'); } catch (e) { flash('error', errMsg(e)); } };
  const decide = async (id, action) => {
    try { const { data } = await api.patch(`/bookings/${id}/${action}`); loadBookings();
      flash('ok', action === 'approve' ? `Approved. Auto-rejected ${data.data.autoRejected ?? 0} overlapping request(s).` : 'Rejected');
    } catch (e) { flash('error', errMsg(e)); }
  };
  const blockMaintenance = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post(`/spaces/${mt.spaceId}/maintenance`, mt); flash('ok', `Blocked. ${data.data.autoRejected} booking(s) auto-rejected.`); loadBookings(); }
    catch (e) { flash('error', errMsg(e)); }
  };

  return (
    <section>
      <h1>Admin dashboard</h1>
      <div className="tabs">
        {['bookings', 'spaces', 'maintenance'].map(t =>
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {msg && <div className={`alert ${msg.type === 'ok' ? 'success' : 'error'}`}>{msg.text}</div>}

      {tab === 'bookings' && (
        <>
          <div className="filters card">
            <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All statuses</option>
              {['pending', 'approved', 'rejected', 'cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
            <input type="date" value={filter.date} onChange={e => setFilter({ ...filter, date: e.target.value })} />
            <select value={filter.spaceId} onChange={e => setFilter({ ...filter, spaceId: e.target.value })}>
              <option value="">All spaces</option>{spaces.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member</th><th>Space</th><th>Date</th><th>Slot</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b._id}>
                    <td>{b.user?.name || (b.kind === 'maintenance' ? '— maintenance —' : '—')}</td>
                    <td>{b.space?.name}</td><td>{b.date}</td>
                    <td>{new Date(b.startAt).toISOString().slice(11, 16)}–{new Date(b.endAt).toISOString().slice(11, 16)}</td>
                    <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                    <td>{b.status === 'pending' && <>
                      <button className="btn small" onClick={() => decide(b._id, 'approve')}>Approve</button>
                      <button className="btn ghost small" onClick={() => decide(b._id, 'reject')}>Reject</button></>}</td>
                  </tr>
                ))}
                {!bookings.length && <tr><td colSpan="6">No bookings found.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'spaces' && (
        <div className="two-col">
          <form className="card" onSubmit={saveSpace}>
            <h3>{editId ? 'Edit space' : 'Add space'}</h3>
            <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="desk">desk</option><option value="room">room</option></select></label>
            <label>Capacity<input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required /></label>
            <label>Price / hour<input type="number" min="0" value={form.pricePerHour} onChange={e => setForm({ ...form, pricePerHour: e.target.value })} /></label>
            <label>Amenities (comma separated)<input value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <button className="btn full">{editId ? 'Update' : 'Create'}</button>
            {editId && <button type="button" className="btn ghost full" onClick={() => { setEditId(null); setForm(empty); }}>Cancel edit</button>}
          </form>
          <div className="card">
            <h3>Spaces ({spaces.length})</h3>
            <div className="table-wrap">
              <table><thead><tr><th>Name</th><th>Type</th><th>Cap</th><th></th></tr></thead>
                <tbody>{spaces.map(s => (
                  <tr key={s._id}><td>{s.name}</td><td>{s.type}</td><td>{s.capacity}</td>
                    <td><button className="btn small" onClick={() => edit(s)}>Edit</button>
                      <button className="btn ghost small" onClick={() => del(s._id)}>Delete</button></td></tr>))}
                </tbody></table>
            </div>
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <form className="card narrow" onSubmit={blockMaintenance}>
          <h3>Block maintenance window</h3>
          <label>Space<select value={mt.spaceId} onChange={e => setMt({ ...mt, spaceId: e.target.value })} required>
            <option value="">Select…</option>{spaces.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
          <label>Date<input type="date" value={mt.date} onChange={e => setMt({ ...mt, date: e.target.value })} required /></label>
          <label>Start<input type="time" value={mt.start} onChange={e => setMt({ ...mt, start: e.target.value })} required /></label>
          <label>End<input type="time" value={mt.end} onChange={e => setMt({ ...mt, end: e.target.value })} required /></label>
          <button className="btn full">Block slot</button>
        </form>
      )}
    </section>
  );
}
