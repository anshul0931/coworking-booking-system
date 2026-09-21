import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../api/auth.jsx';
import { errMsg } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await login(f.email, f.password); nav('/'); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>Login</h2>
      <label>Email<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></label>
      <label>Password<input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></label>
      <button className="btn full">Login</button>
      {err && <div className="alert error">{err}</div>}
      <p className="muted">No account? <Link to="/register">Register</Link></p>
      <p className="muted small">Demo: admin@cowork.com / admin123 · member@cowork.com / member123</p>
    </form>
  );
}
