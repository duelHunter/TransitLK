import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        TransitLK
      </Link>
      <div className="nav-links">
        <Link to="/search">Search &amp; Book</Link>
        {user && <Link to="/tickets">My Tickets</Link>}
        <Link to="/live-map">Live Map</Link>
        {user && (user.role === 'CONDUCTOR' || user.role === 'OPERATOR' || user.role === 'ADMIN') && (
          <Link to="/trips">Trips</Link>
        )}
        {user && (user.role === 'CONDUCTOR' || user.role === 'ADMIN') && (
          <Link to="/validate">Validate Ticket</Link>
        )}
      </div>
      <div className="nav-user">
        {user ? (
          <>
            <span>
              {user.name} ({user.role})
            </span>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
