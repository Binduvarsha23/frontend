import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "../firebase";
import { useNavigate } from "react-router-dom";

function SocialLogins() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/details");
    } catch (error) {
      alert("Google sign-in error: " + error.message);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      await signInWithPopup(auth, facebookProvider);
      navigate("/details");
    } catch (error) {
      alert("Facebook sign-in error: " + error.message);
    }
  };

  return (
    <div className="social-logins">
      <button onClick={handleGoogleLogin} className="google-btn">
        Continue with Google
      </button>
      <button onClick={handleFacebookLogin} className="facebook-btn">
        Continue with Facebook
      </button>
    </div>
  );
}

export default SocialLogins;
