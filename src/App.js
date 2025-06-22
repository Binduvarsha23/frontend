import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import Dashboard from "./components/Dashboard";
import ForgotPassword from "./components/ForgotPassword";
import { auth } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import BlockForm from "./components/BlockForm";
import CustomBlockForm from "./components/CustomBlockForm";
import AdminPanel from "./components/AdminPanel";

function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/signin" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin" element={<AdminPanel/>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
                <Route
          path="/dashboard/block/:blockId"
          element={
            <ProtectedRoute>
             <BlockForm/>
            </ProtectedRoute>
          }

        /><Route path="/dashboard/custom/:blockId" element={<ProtectedRoute>
          <CustomBlockForm/>
          </ProtectedRoute>} />


        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Router>
  );
}

export default App;
