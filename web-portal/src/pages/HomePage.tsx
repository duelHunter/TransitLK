import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { landingPath } from '../lib/landing';

export function HomePage() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const path = landingPath(user.role);
  if (path) return <Navigate to={path} replace />;

  const app = user.role === 'CONDUCTOR' ? 'TransitLK Conductor' : 'TransitLK';
  return (
    <div className="card auth-card">
      <h1>Use the mobile app</h1>
      <p>
        {user.role === 'CONDUCTOR' ? 'Conductors' : 'Passengers'} work in the <strong>{app}</strong> mobile
        app. This web portal is for fleet operators.
      </p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
