import React, { useEffect, useState, useCallback } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import PatternLock from "react-pattern-lock"; // Import PatternLock

const API = "https://backend-pbmi.onrender.com/api/security-config";

const SecurityGate = ({ children }) => {
  const [user, loadingUser] = useAuthState(auth);
  const [isVerified, setIsVerified] = useState(false);
  // Initial state: Assume locked and modal shown if a user is present,
  // until the config is fetched and proves otherwise.
  const [forceLock, setForceLock] = useState(true);
  const [config, setConfig] = useState(null); // config will be null until fetched
  // Initialize authMethod to null, so no specific method is shown by default
  const [authMethod, setAuthMethod] = useState(null);
  const [inputValue, setInputValue] = useState(""); // Used for PIN/Password
  const [pattern, setPattern] = useState([]); // Used for PatternLock
  const [error, setError] = useState("");
  // Initial state: Modal is shown by default if we expect a lock (i.e., user is present)
  const [showModal, setShowModal] = useState(true);
  const [step, setStep] = useState("enter");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [token, setToken] = useState("");
  const [newValue, setNewValue] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Memoized function to fetch configuration, preventing unnecessary re-renders
  const fetchConfig = useCallback(async () => {
    if (!user) {
      // If no user, ensure the gate is unlocked (or redirect to login)
      setIsVerified(true);
      setForceLock(false);
      setShowModal(false);
      setError("User not authenticated. Please log in.");
      // Reset authMethod if no user is present
      setAuthMethod(null);
      return;
    }

    try {
      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data.config;

      if (res.data.setupRequired || !(cfg.pinEnabled || cfg.passwordEnabled || cfg.patternEnabled)) {
        // If setup is required or no security method is enabled, the gate should be unlocked.
        setIsVerified(true);
        setForceLock(false);
        // Explicitly set authMethod to null if no method is enabled BEFORE hiding modal
        setAuthMethod(null);
        setShowModal(false); // Crucial: Hide modal if no security is needed
      } else {
        // A security method IS enabled, so the gate should be locked and modal shown.
        const methods = ["pin", "password", "pattern"];
        // Find the last enabled method, prioritizing them (pattern > password > pin)
        const lastEnabled = methods.findLast((method) => cfg[`${method}Enabled`]);

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
      // Also reset authMethod on error to avoid showing stale method
      setAuthMethod(null);
    }
  }, [user]); // Only re-create fetchConfig if 'user' changes

  // Initial config fetch on component mount or user change
  useEffect(() => {
    if (user) {
      fetchConfig();
    } else if (!loadingUser) {
      // If user is null and not loading, it means no user is logged in.
      // Unlock the gate and hide the modal.
      setIsVerified(true);
      setForceLock(false);
      setShowModal(false);
      setError("User not authenticated. Please log in.");
      setAuthMethod(null); // Ensure authMethod is cleared
    }
  }, [user, loadingUser, fetchConfig]); // fetchConfig is a dependency because it's memoized

  // Force lock on tab switch (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        // Immediately lock the gate and show the modal
        // This provides instant visual feedback to the user.
        setIsVerified(false);
        setForceLock(true);
        setShowModal(true);
        setStep("enter"); // Reset to the initial 'enter' step
        setError(""); // Clear any previous errors
        setInputValue(""); // Clear input fields
        setPattern([]); // Clear pattern input
        // Set config to null and authMethod to null to show loading state
        setConfig(null);
        setAuthMethod(null);

        // Then, fetch the latest configuration in the background.
        // fetchConfig will then correctly adjust the lock state
        // based on whether a security method is actually enabled.
        fetchConfig();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, fetchConfig]); // fetchConfig is a dependency because it's memoized

  const verify = async () => {
    setVerifying(true); // Start loading spinner
    setError(""); // Clear previous errors

    let valueToVerify = inputValue;
    if (authMethod === "pattern") {
      if (pattern.length < 3) {
        setError("Pattern must connect at least 3 dots.");
        setVerifying(false);
        return;
      }
      valueToVerify = JSON.stringify(pattern); // Convert pattern array to string for API
    }

    try {
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
    } catch (err) {
      console.error("Verification failed:", err);
      setError("Verification failed. Please try again.");
    } finally {
      setVerifying(false); // Stop loading spinner
    }
  };

  const sendResetEmail = async () => {
    setVerifying(true); // Start loading spinner
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
        setError("Failed to send reset email.");
      }
    } catch (err) {
      console.error("Error sending reset code:", err);
      setError(err.response?.data?.message || "Error sending reset code.");
    } finally {
      setVerifying(false); // Stop loading spinner
    }
  };

  const resetWithToken = async () => {
    setVerifying(true); // Start loading spinner
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
        setError("Reset failed.");
      }
    } catch (err) {
      console.error("Error resetting method:", err);
      setError("Error resetting method.");
    } finally {
      setVerifying(false); // Stop loading spinner
    }
  };

  const verifyAnswer = async () => {
    setVerifying(true); // Start loading spinner
    setError("");
    try {
      const res = await axios.post(`${API}/verify-security-answer`, {
        userId: user.uid,
        question: selectedQuestion,
        answer,
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
        setError("Incorrect answer.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError("Verification error.");
    } finally {
      setVerifying(false); // Stop loading spinner
    }
  };

  // 🔐 FINAL GUARD: Don't render anything while locked
  // Show modal if user is loading, or if user exists but is not verified AND forceLock is true
  if (loadingUser || !user || (forceLock && !isVerified)) {
    return (
      <Modal show={showModal} centered backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>
            {loadingUser || !user ? "Loading User..." :
             config === null ? "Checking Security Settings..." : // Improved loading message
             // Only display the auth method if it's not null, otherwise no title needed
             authMethod ? ({
              enter: `Enter your ${authMethod}`,
              forgot: `Forgot ${authMethod}`,
              "verify-code": "Enter Reset Code",
              "set-new": `Set New ${authMethod}`,
            })[step] : " "} {/* Empty string if authMethod is null */}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingUser || !user ? (
            <div className="text-center">
              <Spinner animation="border" className="mb-3" />
              <p>{loadingUser ? "Authenticating user..." : "Please log in to access."}</p>
            </div>
          ) : config === null ? (
            <div className="text-center">
              <Spinner animation="border" className="mb-3" />
              <p>Loading security configuration...</p> {/* Improved loading message */}
            </div>
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}

              {/* Only render authentication input if authMethod is not null */}
              {step === "enter" && authMethod && (
                <>
                  {authMethod === "pattern" ? (
                    <div className="text-center p-3 rounded" style={{ backgroundColor: '#343a40', color: '#ffffff' }}> {/* Dark background for pattern */}
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
                        disabled={verifying} // Disable pattern drawing while verifying
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
                    <Button onClick={verify} disabled={verifying}>
                      {verifying ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Verifying...
                        </>
                      ) : (
                        "Verify"
                      )}
                    </Button>
                    <Button variant="link" onClick={() => setStep("forgot")} disabled={verifying}>Forgot?</Button>
                  </div>
                </>
              )}

              {/* Removed the "Access Granted" message block as the modal will close if authMethod is null */}

              {step === "forgot" && (
                <>
                  <Button className="w-100 mb-2" onClick={sendResetEmail} disabled={verifying}>
                    {verifying ? (
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
                        disabled={verifying}
                      >
                        <option value="">Choose Security Question</option> {/* Added value for default option */}
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
                        disabled={verifying}
                      />
                      <Button className="w-100 mb-2" onClick={verifyAnswer} disabled={verifying}>
                        {verifying ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Submitting...
                          </>
                        ) : (
                          "Submit Answer"
                        )}
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" onClick={() => setStep("enter")} disabled={verifying}>
                    I remember my {authMethod}
                  </Button>
                </>
              )}

              {step === "verify-code" && (
                <>
                  <Form.Control
                    className="mb-2"
                    placeholder="Reset Code"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={verifying}
                  />
                  {authMethod === "pattern" ? (
                    <div className="text-center mb-2" style={{ backgroundColor: '#343a40', color: '#ffffff' }}> {/* Dark background for new pattern */}
                      <p className="fw-semibold">Draw New Pattern</p>
                      <PatternLock
                        width={250}
                        size={3}
                        path={pattern} // Using 'pattern' state for new pattern input
                        onChange={(pts) => setPattern(pts || [])}
                        onFinish={() => {
                          if (pattern.length < 3) {
                            setError("New pattern must connect at least 3 dots.");
                          } else {
                            setError("");
                          }
                        }}
                        disabled={verifying} // Disable pattern drawing while verifying
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
                      disabled={verifying}
                    />
                  )}
                  <Button className="w-100 mb-2" onClick={resetWithToken} disabled={verifying}>
                    {verifying ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Resetting...
                      </>
                    ) : (
                      "Reset"
                    )}
                  </Button>
                  <Button variant="secondary" onClick={() => setStep("enter")} disabled={verifying}>
                    I remember my {authMethod}
                  </Button>
                </>
              )}
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
