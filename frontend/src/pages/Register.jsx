import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../api/auth.jsx';
import { errMsg } from '../api/client';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'member' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await register(f); nav('/'); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>Create account</h2>
      <label>Name<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></label>
      <label>Email<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></label>
      <label>Password<input type="password" minLength={6} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></label>
      <label>Role<select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select></label>
      <button className="btn full">Register</button>
      {err && <div className="alert error">{err}</div>}
      <p className="muted">Already registered? <Link to="/login">Login</Link></p>
    </form>
  );
}
