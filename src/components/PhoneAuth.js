import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const PhoneAuth = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const navigate = useNavigate();

  const setupRecaptcha = () => {
    window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => sendOtp()
    }, auth);
  };

  const sendOtp = async () => {
    if (!phone.startsWith('+91')) {
      alert('Include +91 or country code');
      return;
    }

    setupRecaptcha();

    const appVerifier = window.recaptchaVerifier;
    try {
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmResult(result);
      alert('OTP sent to ' + phone);
    } catch (err) {
      console.error(err.message);
      alert('Failed to send OTP');
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      alert('Enter 6-digit OTP');
      return;
    }

    try {
      await confirmResult.confirm(otp);
      alert('Phone verified!');
      navigate('/email-form', { state: { phone } }); // pass phone to next page
    } catch (err) {
      alert('Invalid OTP');
      console.error(err.message);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: '500px' }}>
      <div className="card p-4 shadow">
        <h3 className="mb-3 text-center">DocVault - Phone Verification</h3>

        <label className="form-label">Phone Number (+91XXXXXXXXXX)</label>
        <input className="form-control mb-3" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />

        {confirmResult ? (
          <>
            <label className="form-label">Enter OTP</label>
            <input className="form-control mb-3" value={otp} onChange={e => setOtp(e.target.value)} />
            <button className="btn btn-success w-100" onClick={verifyOtp}>Verify OTP</button>
          </>
        ) : (
          <button className="btn btn-primary w-100" onClick={sendOtp}>Send OTP</button>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
};

export default PhoneAuth;
