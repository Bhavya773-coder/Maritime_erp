import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TasksPage from './pages/tasks/TasksPage';
import TaskDetailPage from './pages/tasks/TaskDetailPage';
import FleetPage from './pages/fleet/FleetPage';
import VesselDetailPage from './pages/fleet/VesselDetailPage';
import CertificationsPage from './pages/certifications/CertificationsPage';
import CertificationDetailPage from './pages/certifications/CertificationDetailPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks" 
            element={
              <ProtectedRoute>
                <TasksPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tasks/:id" 
            element={
              <ProtectedRoute>
                <TaskDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/fleet" 
            element={
              <ProtectedRoute>
                <FleetPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/fleet/:id" 
            element={
              <ProtectedRoute>
                <VesselDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/certifications" 
            element={
              <ProtectedRoute>
                <CertificationsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/certifications/:id" 
            element={
              <ProtectedRoute>
                <CertificationDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
