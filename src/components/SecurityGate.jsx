import React, { useEffect, useState, useCallback } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import PatternLock from "react-pattern-lock"; // Import PatternLock

const API = "https://backend-pbmi.onrender.com/api/security-config";

// Helper function to convert Base64Url to ArrayBuffer
function base64urlToArrayBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array.buffer;
}

const SecurityGate = ({ children }) => {
  const [user, loadingUser] = useAuthState(auth);
  const [isVerified, setIsVerified] = useState(false);
  const [forceLock, setForceLock] = useState(true);
  const [config, setConfig] = useState(null);
  const [authMethod, setAuthMethod] = useState(null);
  const [inputValue, setInputValue] = useState(""); // Used for PIN/Password
  const [pattern, setPattern] = useState([]); // Used for PatternLock
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false); // Initially hide modal
  const [step, setStep] = useState("enter");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [token, setToken] = useState("");
  const [newValue, setNewValue] = useState("");
  const [verifying, setVerifying] = useState(false); // For primary auth method verification
  const [isSendingEmail, setIsSendingEmail] = useState(false); // For email sending spinner
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false); // For security answer submission spinner
  const [isResettingMethod, setIsResettingMethod] = useState(false); // For reset with token spinner
  const [biometricCredentials, setBiometricCredentials] = useState([]); 
  const [isLoadingConfig, setIsLoadingConfig] = useState(true); // New state for initial config loading

  // Memoized function to fetch configuration, preventing unnecessary re-renders
  const fetchConfig = useCallback(async () => {
    if (!user) {
      setIsVerified(true);
      setForceLock(false);
      setShowModal(false);
      setError("User not authenticated. Please log in.");
      setIsLoadingConfig(false); // Stop loading config if no user
      return;
    }

    try {
      setIsLoadingConfig(true); // Start loading config
      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data.config;

      // Set biometricCredentials from config
      if (cfg.biometricEnabled && cfg.biometricCredentials && cfg.biometricCredentials.length > 0) {
        setBiometricCredentials(cfg.biometricCredentials);
      } else {
        setBiometricCredentials([]); // Clear if not enabled or no credentials
      }

      if (res.data.setupRequired || !(cfg.pinEnabled || cfg.passwordEnabled || cfg.patternEnabled || cfg.biometricEnabled)) {
        // If setup is required or no security method is enabled, the gate should be unlocked.
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false); // Hide modal
      } else {
        // A security method IS enabled, so the gate should be locked and modal shown.
        const methods = ["biometric", "pattern", "password", "pin"]; // Prioritize biometric
        const lastEnabled = methods.find((method) => cfg[`${method}Enabled`]);

        setAuthMethod(lastEnabled); // Set the active authentication method
        setIsVerified(false); // User is not yet verified
        setForceLock(true); // Force the gate to be locked
        setShowModal(true); // Show the authentication modal
        setStep("enter"); // Reset to the initial 'enter' step
        setError(""); // Clear any previous errors
        setInputValue(""); // Clear input fields
        setPattern([]); // Clear pattern input
      }
      setConfig(cfg); // Update the configuration state
    } catch (err) {
      console.error("Error fetching config:", err);
      setError("Failed to fetch security settings. Access granted for now."); // Inform user but allow access
      setIsVerified(true); // Grant access in case of fetch error to prevent blocking
      setForceLock(false);
      setShowModal(false);
      setAuthMethod(null);
    } finally {
      setIsLoadingConfig(false); // Stop loading config regardless of success/failure
    }
  }, [user]);

  // Initial config fetch on component mount or user change
  useEffect(() => {
    if (user) {
      fetchConfig();
    } else if (!loadingUser) {
      setIsVerified(true);
      setForceLock(false);
      setShowModal(false);
      setError("User not authenticated. Please log in.");
      setIsLoadingConfig(false); // Stop loading if no user and auth is done
    }
  }, [user, loadingUser, fetchConfig]);

  // Force lock on tab switch (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        setIsVerified(false);
        setForceLock(true);
        setShowModal(true);
        setStep("enter");
        setError("");
        setInputValue("");
        setPattern([]);
        setConfig(null); // Reset config to trigger re-fetch
        setAuthMethod(null);
        fetchConfig(); // Re-fetch config to determine if lock is needed
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, fetchConfig]);

  const verify = async () => {
    setVerifying(true); // Start loading spinner for primary verification
    setError(""); // Clear previous errors

    try {
      if (authMethod === "biometric") {
        if (!window.PublicKeyCredential) {
          throw new Error("WebAuthn (Biometric) is not supported in this browser or environment (requires HTTPS).");
        }
        // Check if there are any registered biometric credentials
        if (!biometricCredentials || biometricCredentials.length === 0) {
            throw new Error("No biometric credential registered for this user on this device. Please enable it in Security Settings.");
        }

        // In a real app, you'd fetch a challenge from your backend for security
        // For this example, we'll use a dummy challenge.
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyCredentialRequestOptions = {
          challenge: challenge,
          // Map the stored biometricCredentials to the format expected by allowCredentials
          allowCredentials: biometricCredentials.map(cred => ({
            id: base64urlToArrayBuffer(cred.credentialID), // Use the stored credential ID
            type: 'public-key',
            // Include transports if stored, otherwise default to 'internal'
            transports: cred.transports && cred.transports.length > 0 ? cred.transports : ['internal'] 
          })),
          userVerification: "required", // Require biometric verification
          timeout: 60000,
        };

        const credential = await navigator.credentials.get({
          publicKey: publicKeyCredentialRequestOptions,
        });

        // In a real app, you would send 'credential' to your backend for verification
        // This would involve sending credential.rawId, credential.response.authenticatorData, etc.
        // For this demo, we'll just simulate success after the biometric prompt.
        console.log("Biometric credential obtained:", credential);
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setError("");
        // No input to clear for biometric
      } else {
        let valueToVerify = inputValue;
        if (authMethod === "pattern") {
          if (pattern.length < 3) {
            setError("Pattern must connect at least 3 dots.");
            setVerifying(false);
            return;
          }
          valueToVerify = JSON.stringify(pattern); // Convert pattern array to string for API
        }

        const res = await axios.post(`${API}/verify`, {
          userId: user.uid,
          value: valueToVerify,
          method: authMethod,
        });
        if (res.data.success) {
          setIsVerified(true);
          setForceLock(false);
          setShowModal(false);
          setInputValue("");
          setPattern([]); // Clear pattern after successful verification
          setError("");
        } else {
          setError("Invalid " + authMethod);
        }
      }
    } catch (err) {
      console.error("Verification failed:", err);
      // More specific error messages
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setError("Biometric verification cancelled or denied by user.");
      } else if (err.message.includes("supported")) {
        setError(err.message);
      } else if (err.message.includes("No biometric credential registered")) {
        setError(err.message); // Display the specific error for no credential
      } else if (axios.isAxiosError(err) && err.response?.data?.message) {
          setError(err.response.data.message); // Display backend error message
      }
      else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setVerifying(false); // Stop loading spinner
    }
  };

  const sendResetEmail = async () => {
    setIsSendingEmail(true); // Start email sending spinner
    setError("");
    try {
      const res = await axios.post(`${API}/request-method-reset`, {
        userId: user.uid,
        email: user.email,
        methodToReset: authMethod,
      });
      if (res.data.success) {
        setStep("verify-code");
        setError("");
      } else {
        // Display backend error message if available
        setError(res.data.message || "Failed to send reset email.");
      }
    } catch (err) {
      console.error("Error sending reset code:", err);
      // Display backend error message if available
      setError(axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : "Error sending reset code.");
    } finally {
      setIsSendingEmail(false); // Stop email sending spinner
    }
  };

  const resetWithToken = async () => {
    setIsResettingMethod(true); // Start reset with token spinner
    setError("");
    try {
      // For pattern reset, newValue would need to be a stringified pattern
      const valueToReset = authMethod === "pattern" ? JSON.stringify(pattern) : newValue;

      const res = await axios.post(`${API}/reset-method-with-token`, {
        userId: user.uid,
        token,
        methodType: authMethod,
        newValue: valueToReset,
      });
      if (res.data.success) {
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setStep("enter");
        setInputValue("");
        setPattern([]);
        setNewValue("");
        setToken("");
        setError("");
      } else {
        // Display backend error message if available
        setError(res.data.message || "Reset failed.");
      }
    } catch (err) {
      console.error("Error resetting method:", err);
      // Display backend error message if available
      setError(axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : "Error resetting method.");
    } finally {
      setIsResettingMethod(false); // Stop reset with token spinner
    }
  };

  const verifyAnswer = async () => {
    setIsSubmittingAnswer(true); // Start security answer submission spinner
    setError("");
    try {
      const res = await axios.post(`${API}/verify-security-answer`, {
        userId: user.uid,
        question: selectedQuestion,
        answer: answer.trim(), // IMPORTANT FIX: Trim the answer here
      });
      if (res.data.success) {
        setIsVerified(true);
        setForceLock(false);
        setShowModal(false);
        setStep("enter");
        setAnswer("");
        setSelectedQuestion("");
        setError("");
      } else {
        // Display backend error message if available
        setError(res.data.message || "Incorrect answer.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      // Display backend error message if available
      setError(axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : "Verification error.");
    } finally {
      setIsSubmittingAnswer(false); // Stop security answer submission spinner
    }
  };

  // 🔐 Initial Loading Guard: Show a full-page spinner while config is loading
  if (loadingUser || isLoadingConfig) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <Spinner animation="border" role="status" className="mb-3" />
        <p className="text-muted">Loading security configuration...</p>
      </div>
    );
  }

  // 🔐 FINAL GUARD: Don't render anything while locked (and config is loaded)
  // Show modal if user exists but is not verified AND forceLock is true AND config is loaded
  if (!isVerified && forceLock) {
    return (
      <Modal show={showModal} centered backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>
            {config === null ? "Checking Security Settings..." : // Should not happen with isLoadingConfig
              authMethod ? ({
                enter: `Enter your ${authMethod}`,
                forgot: `Forgot ${authMethod}`,
                "verify-code": "Enter Reset Code",
                "set-new": `Set New ${authMethod}`,
              })[step] || `Verify with ${authMethod}` : "Security Check"} {/* Fallback for biometric title */}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {step === "enter" && authMethod && (
            <>
              {authMethod === "biometric" ? (
                <div className="text-center p-3">
                  <p className="lead">
                    {verifying ? "Scanning biometric..." : "Please verify with your biometric sensor."}
                  </p>
                  {verifying ? (
                    <Spinner animation="border" className="mb-3" />
                  ) : (
                    <Button onClick={verify} disabled={verifying}>
                      Verify with Biometric
                    </Button>
                  )}
                  <p className="mt-3 text-muted">
                    (e.g., Fingerprint, Face ID via Windows Hello/Touch ID)
                  </p>
                </div>
              ) : authMethod === "pattern" ? (
                <div className="text-center p-3 rounded" style={{ backgroundColor: '#343a40', color: '#ffffff' }}>
                  <p className="fw-semibold">Draw Your Pattern</p>
                  <PatternLock
                    width={250}
                    size={3}
                    path={pattern}
                    onChange={(pts) => setPattern(pts || [])}
                    onFinish={() => {
                      if (pattern.length < 3) {
                        setError("Pattern must connect at least 3 dots.");
                      } else {
                        setError("");
                      }
                    }}
                    disabled={verifying}
                  />
                </div>
              ) : (
                <Form.Control
                  type={authMethod === "password" ? "password" : "text"}
                  inputMode={authMethod === "pin" ? "numeric" : "text"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Enter ${authMethod}`}
                  autoFocus
                  disabled={verifying}
                />
              )}
              <div className="mt-3 d-flex justify-content-between">
                {authMethod !== "biometric" && ( // Only show verify button for non-biometric methods
                  <Button onClick={verify} disabled={verifying}>
                    {verifying ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                )}
                <Button
                  variant="link"
                  onClick={() => setStep("forgot")}
                  disabled={verifying || authMethod === "biometric"} // Disable "Forgot?" for biometric
                  title={authMethod === "biometric" ? "Biometric cannot be reset via this method. Please re-enable it in Security Settings." : "Forgot your credentials?"}
                >
                  Forgot?
                </Button>
              </div>
            </>
          )}

          {step === "forgot" && (
            <>
              {authMethod === "biometric" ? (
                  <Alert variant="info" className="text-center">
                    Biometric authentication cannot be reset via email or security questions.
                    To reset or re-register, please disable and re-enable it in your Security Settings.
                  </Alert>
              ) : (
                <>
                  <Button className="w-100 mb-2" onClick={sendResetEmail} disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}>
                    {isSendingEmail ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Sending...
                      </>
                    ) : (
                      "Send Reset Code to Email"
                    )}
                  </Button>
                  {config?.securityQuestions?.length > 0 && (
                    <>
                      <Form.Select
                        className="mb-2"
                        value={selectedQuestion}
                        onChange={(e) => setSelectedQuestion(e.target.value)}
                        disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}
                      >
                        <option value="">Choose Security Question</option>
                        {config.securityQuestions.map((q, i) => (
                          <option key={i} value={q.question}>{q.question}</option>
                        ))}
                      </Form.Select>
                      <Form.Control
                        type="text"
                        className="mb-2"
                        placeholder="Answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}
                      />
                      <Button className="w-100 mb-2" onClick={verifyAnswer} disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}>
                        {isSubmittingAnswer ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Submitting...
                          </>
                        ) : (
                          "Submit Answer"
                        )}
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" onClick={() => setStep("enter")} disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}>
                    I remember my {authMethod}
                  </Button>
                </>
              )}
            </>
          )}

          {step === "verify-code" && (
            <>
              <Form.Control
                className="mb-2"
                placeholder="Reset Code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}
              />
              {authMethod === "pattern" ? (
                <div className="text-center mb-2" style={{ backgroundColor: '#343a40', color: '#ffffff' }}>
                  <p className="fw-semibold">Draw New Pattern</p>
                  <PatternLock
                    width={250}
                    size={3}
                    path={pattern}
                    onChange={(pts) => setPattern(pts || [])}
                    onFinish={() => {
                      if (pattern.length < 3) {
                        setError("New pattern must connect at least 3 dots.");
                      } else {
                        setError("");
                      }
                    }}
                    disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}
                  />
                </div>
              ) : (
                <Form.Control
                  className="mb-2"
                  type={authMethod === "password" ? "password" : "text"}
                  inputMode={authMethod === "pin" ? "numeric" : "text"}
                  placeholder={`New ${authMethod}`}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}
                />
              )}
              <Button className="w-100 mb-2" onClick={resetWithToken} disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}>
                {isResettingMethod ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Resetting...
                  </>
                ) : (
                  "Reset"
                )}
              </Button>
              <Button variant="secondary" onClick={() => setStep("enter")} disabled={isSendingEmail || isSubmittingAnswer || isResettingMethod}>
                I remember my {authMethod}
              </Button>
            </>
          )}
        </Modal.Body>
      </Modal>
    );
  }

  // ✅ Unlock everything
  return <>{children}</>;
};

export default SecurityGate;
