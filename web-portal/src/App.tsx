import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { TripsPage } from './pages/TripsPage';
import { OperatorPage } from './pages/OperatorPage';

function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route
            path="/operator"
            element={
              <ProtectedRoute roles={['OPERATOR']}>
                <OperatorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <ProtectedRoute roles={['OPERATOR', 'ADMIN']}>
                <TripsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live-map"
            element={
              <ProtectedRoute roles={['OPERATOR', 'ADMIN']}>
                <LiveMapPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
