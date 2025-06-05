// SignUp.js
import React, { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  facebookProvider,
} from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaGoogle, FaFacebook } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";
import bgImage from "../assets/signIn.webp";

export default function SignUp() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      await sendEmailVerification(userCredential.user);
      toast.success("Signup successful! Verification email sent.");
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes("email-already-in-use")) {
        toast.error("Email is already in use.");
      } else if (msg.includes("invalid-email")) {
        toast.error("Invalid email address.");
      } else {
        toast.error("Signup failed. Please try again.");
      }
    }
  };

  const handleRedirectSignup = (provider) => {
    signInWithRedirect(auth, provider);
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          toast.success("Signed in successfully!");
          setTimeout(() => navigate("/dashboard"), 2000);
        }
      })
      .catch((error) => {
        if (error) {
          toast.error("Social sign-in failed.");
        }
      });
  }, [navigate]);

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
        <h2 className="mb-4 text-center">Register</h2>
        <form onSubmit={handleSignUp}>
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
          </div>
          <button type="submit" className="btn btn-light w-100 fw-semibold rounded-pill">
            Sign Up
          </button>
        </form>

        <button
          onClick={() => handleRedirectSignup(googleProvider)}
          className="btn btn-danger w-100 fw-semibold rounded-pill mt-3 d-flex align-items-center justify-content-center gap-2"
        >
          <FaGoogle /> Continue with Google
        </button>

        <button
          onClick={() => handleRedirectSignup(facebookProvider)}
          className="btn btn-primary w-100 fw-semibold rounded-pill mt-2 d-flex align-items-center justify-content-center gap-2"
        >
          <FaFacebook /> Continue with Facebook
        </button>

        <div className="mt-4 text-center" style={{ fontSize: "14px" }}>
          Already have an account? <Link to="/" className="text-white fw-semibold">Sign In</Link>
        </div>
        
      </div><ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </div>
  );
}
