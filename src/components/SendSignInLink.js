// src/components/SendSignInLink.js
import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { sendSignInLinkToEmail } from 'firebase/auth';

const SendSignInLink = () => {
  const [email, setEmail] = useState('');

  const handleSendLink = async () => {
    const actionCodeSettings = {
      url: 'http://localhost:3000/complete-signup',
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      alert('Verification link sent! Check your email.');
    } catch (error) {
      console.error('Error sending email link:', error);
    }
  };

  return (
    <div>
      <h2>DocVault Sign Up</h2>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
      />
      <button onClick={handleSendLink}>Send Verification Link</button>
    </div>
  );
};

export default SendSignInLink;
