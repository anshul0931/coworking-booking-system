import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';

export default function Spaces() {
  const [spaces, setSpaces] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [f, setF] = useState({ search: '', type: '', minCapacity: '', date: '', onlyAvailable: false });
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const params = { page, limit: 9 };
      Object.entries(f).forEach(([k, v]) => { if (v !== '' && v !== false) params[k] = v; });
      const { data } = await api.get('/spaces', { params });
      setSpaces(data.data); setMeta(data.meta);
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);
  const apply = (e) => { e.preventDefault(); page === 1 ? load() : setPage(1); };

  return (
    <section>
      <h1>Find your space</h1>
      <p className="muted">Hot desks and meeting rooms, bookable by the hour.</p>

      <form className="filters card" onSubmit={apply}>
        <input placeholder="Search by name" value={f.search} onChange={e => setF({ ...f, search: e.target.value })} />
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
          <option value="">All types</option><option value="desk">Desk</option><option value="room">Meeting room</option>
        </select>
        <input type="number" min="1" placeholder="Min capacity" value={f.minCapacity} onChange={e => setF({ ...f, minCapacity: e.target.value })} />
        <input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
        <label className="check"><input type="checkbox" checked={f.onlyAvailable} onChange={e => setF({ ...f, onlyAvailable: e.target.checked })} /> Available only</label>
        <button className="btn" type="submit">Apply</button>
      </form>

      {err && <div className="alert error">{err}</div>}
      {loading ? <p>Loading spaces…</p> : (
        <>
          <div className="grid">
            {spaces.map(s => (
              <article key={s._id} className="card space">
                <div className="row"><h3>{s.name}</h3><span className={`tag ${s.type}`}>{s.type}</span></div>
                <p className="muted">{s.description}</p>
                <p>Capacity: <b>{s.capacity}</b> · ₹{s.pricePerHour}/hr</p>
                <div className="amenities">{(s.amenities || []).map(a => <span key={a} className="chip">{a}</span>)}</div>
                {'availableOnDate' in s && <p className={s.availableOnDate ? 'ok' : 'bad'}>{s.availableOnDate ? 'Available on selected date' : 'Booked on selected date'}</p>}
                <Link className="btn full" to={`/spaces/${s._id}`}>View & book</Link>
              </article>
            ))}
            {!spaces.length && <p>No spaces match your filters.</p>}
          </div>
          <div className="pager">
            <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span>Page {meta.page} of {meta.totalPages || 1} ({meta.total} spaces)</span>
            <button className="btn ghost" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </>
      )}
    </section>
  );
}
