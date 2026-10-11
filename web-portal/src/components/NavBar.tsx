import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isOperator = user?.role === 'OPERATOR';
  const isStaff = isOperator || user?.role === 'ADMIN';

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        TransitLK Operator Portal
      </Link>
      <div className="nav-links">
        {isOperator && <Link to="/operator">Dashboard</Link>}
        {isStaff && <Link to="/trips">Trips</Link>}
        {isStaff && <Link to="/live-map">Live Map</Link>}
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
