import React from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

function ProtectedRoute({ children }) {
  return auth.currentUser && auth.currentUser.emailVerified ? children : <Navigate to="/signin" />;
}

export default ProtectedRoute;
