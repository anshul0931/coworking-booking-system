import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './api/auth.jsx';
import Spaces from './pages/Spaces.jsx';
import SpaceDetail from './pages/SpaceDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MyBookings from './pages/MyBookings.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">Co<span>Work</span></Link>
          <nav className="nav-links">
            <Link to="/">Spaces</Link>
            {user && <Link to="/my-bookings">My Bookings</Link>}
            {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
            {user
              ? <button className="btn ghost" onClick={async () => { await logout(); nav('/login'); }}>Logout ({user.name})</button>
              : <><Link to="/login">Login</Link><Link className="btn" to="/register">Sign up</Link></>}
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Spaces />} />
          <Route path="/spaces/:id" element={<SpaceDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-bookings" element={<Protected><MyBookings /></Protected>} />
          <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <footer className="footer">CoWork Booking System</footer>
    </>
  );
}
