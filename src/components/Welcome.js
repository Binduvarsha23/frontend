import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Welcome() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  if (!state) {
    // no state, redirect to signup
    navigate("/");
    return null;
  }

  const { name, phone, email } = state;

  return (
    <div className="container mt-5" style={{ maxWidth: "400px" }}>
      <h2>Welcome to DocVault, {name}!</h2>
      <p><strong>Phone:</strong> {phone}</p>
      <p><strong>Email:</strong> {email}</p>
      <p>Please verify your email by clicking the link sent to your inbox.</p>
    </div>
  );
}
