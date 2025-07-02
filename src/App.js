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
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/block/:blockId"
          element={
            <ProtectedRoute>
              <Layout>
                <BlockForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/custom/:blockId"
          element={
            <ProtectedRoute>
              <Layout>
                <CustomBlockForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Routes for menu tabs other than cloud (documents) */}
        <Route path="/app" element={<Navigate to="/app/dashboard" />} />
        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <UserDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/security"
          element={
            <ProtectedRoute>
              <Layout>
                <SecuritySettings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/family"
          element={
            <ProtectedRoute>
              <Layout>
                <WealthPlanning />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/password"
          element={
            <ProtectedRoute>
              <Layout>
                <PasswordManager/>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/wealth"
          element={
            <ProtectedRoute>
              <Layout>
                <WealthDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/:section"
          element={
            <ProtectedRoute>
              <Layout>
                <UnderConstruction />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
