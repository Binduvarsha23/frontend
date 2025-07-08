// App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import ForgotPassword from "./components/ForgotPassword";
import Dashboard from "./components/Dashboard";
import BlockForm from "./components/BlockForm";
import CustomBlockForm from "./components/CustomBlockForm";
import UnderConstruction from "./components/UnderConstruction";
import AdminPanel from "./components/AdminPanel";
import Layout from "./components/Layout";
import UserDashboard from "./components/UserDashboard";
import SecuritySettings from "./components/SecuritySettings";
import WealthDashboard from "./components/WealthDashboard";
import PasswordManager from "./components/PasswordManager";
import WealthPlanning from "./components/WealthPlanning";
import SearchPage from "./components/SearchPage";
import HealthRecords from "./components/HealthRecords";
import SecurityGate from "./components/SecurityGate";
import ResetPasswordPage from "./components/ResetPasswordPage";

function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin" element={<AdminPanel />} />
        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <Dashboard />
              </Layout>
              </SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/block/:blockId"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <BlockForm />
              </Layout>
              </SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/custom/:blockId"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <CustomBlockForm />
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        {/* Routes for menu tabs other than cloud (documents) */}
        <Route path="/app" element={<Navigate to="/app/dashboard" />} />
        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <UserDashboard />
              </Layout>
              </SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/security"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <SecuritySettings />
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/family"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <WealthPlanning />
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/passwords"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <PasswordManager/>
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/wealth"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <WealthDashboard />
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/search-page"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <SearchPage/>
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/health"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <HealthRecords/>
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/:section"
          element={
            <ProtectedRoute>
              <SecurityGate>
              <Layout>
                <UnderConstruction />
              </Layout></SecurityGate>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
