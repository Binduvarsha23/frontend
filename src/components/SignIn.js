// SignIn.js
import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaGoogle, FaFacebook } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";
import bgImage from "../assets/signIn.webp";

export default function SignIn() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const userCred = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      if (!userCred.user.emailVerified) {
        toast.warning("Please verify your email before logging in.");
        return;
      }
      toast.success("Signed in successfully!");
      navigate("/app");
    } catch (err) {
      toast.error(err.message || "Sign in failed.");
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      const result = await signInWithPopup(auth, provider);
      toast.success("Signed in successfully!");
      navigate("/app");
    } catch (error) {
      toast.error("Social sign-in failed.");
      console.error(error);
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center vh-100"
      style={{
        background: `url(${bgImage})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        fontFamily: "Poppins, sans-serif"
      }}
    >
      <div className="bg-white bg-opacity-25 border border-white border-opacity-50 rounded-4 p-4 text-white w-100" style={{ maxWidth: "380px", backdropFilter: "blur(10px)" }}>
        <h2 className="mb-4 text-center">Login</h2>
        <form onSubmit={handleSignIn}>
          <div className="mb-3 text-start">
            <label htmlFor="email" className="form-label fw-semibold">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="form-control bg-transparent text-white border-0 border-bottom"
            />
          </div>
          <div className="mb-3 text-start">
  <label htmlFor="password" className="form-label fw-semibold">Password</label>
  <input
    type="password"
    name="password"
    value={form.password}
    onChange={handleChange}
    required
    className="form-control bg-transparent text-white border-0 border-bottom"
  />
  <small className="mt-1 d-block" style={{ fontSize: "12px" }}>
    If you used <strong>Continue with Google</strong> to sign up, please use it again to sign in,
    or <Link to="/forgot-password" className="text-decoration-underline text-light">reset your password</Link>.
  </small>
</div>

          <div className="d-flex justify-content-between mb-3" style={{ fontSize: "12px" }}>
            <label><input type="checkbox" className="me-2" />Remember Me</label>
            <Link to="/forgot-password" className="text-white">Forget Password</Link>
          </div>
          <button type="submit" className="btn btn-light w-100 fw-semibold rounded-pill">
            Log in
          </button>
        </form>

        <button
          onClick={() => handleSocialLogin(googleProvider)}
          className="btn btn-danger w-100 fw-semibold rounded-pill mt-3 d-flex align-items-center justify-content-center gap-2"
        >
          <FaGoogle /> Continue with Google
        </button>

        <button
          onClick={() => handleSocialLogin(facebookProvider)}
          className="btn btn-primary w-100 fw-semibold rounded-pill mt-2 d-flex align-items-center justify-content-center gap-2"
        >
          <FaFacebook /> Continue with Facebook
        </button>

        <div className="mt-4 text-center" style={{ fontSize: "14px" }}>
          Don’t have an account? <Link to="/signup" className="text-white fw-semibold">Register</Link>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </div>
  );
}
