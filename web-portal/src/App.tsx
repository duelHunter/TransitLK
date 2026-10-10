import { Navigate, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { SearchBookPage } from './pages/SearchBookPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { ValidateTicketPage } from './pages/ValidateTicketPage';
import { TripsPage } from './pages/TripsPage';
import { OperatorPage } from './pages/OperatorPage';
import { RegulatorPage } from './pages/RegulatorPage';

function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/search" element={<SearchBookPage />} />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <MyTicketsPage />
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
          <Route
            path="/validate"
            element={
              <ProtectedRoute roles={['CONDUCTOR', 'ADMIN']}>
                <ValidateTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <ProtectedRoute roles={['CONDUCTOR', 'OPERATOR', 'ADMIN']}>
                <TripsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator"
            element={
              <ProtectedRoute roles={['OPERATOR']}>
                <OperatorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/regulator"
            element={
              <ProtectedRoute roles={['REGULATOR', 'ADMIN']}>
                <RegulatorPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
