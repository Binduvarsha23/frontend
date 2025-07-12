// SecuritySettings.jsx
import React, { useEffect, useState } from "react";
import { Button, Card, Form, Row, Col, Spinner, Alert, Dropdown } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase"; // Assuming firebase.js is correctly configured
import { format } from "date-fns";
import PatternLock from "react-pattern-lock";

const API = "https://backend-pbmi.onrender.com/api/security-config";

const FIXED_SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What is your favorite food?",
  "In what city were you born?",
  "What was the name of your favorite teacher?",
  "What is the name of your best friend?",
  "What was your childhood nickname?",
  "What is your mother's maiden name?",
  "What was the make of your first car?",
  "What is your favorite book?",
  "What is your favorite movie?",
];

// Helper function to convert ArrayBuffer to Base64Url
function arrayBufferToBase64url(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const SecuritySettings = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [pattern, setPattern] = useState([]);
  const [confirmPattern, setConfirmPattern] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false); // New state for saving indicator

  const [securityQuestions, setSecurityQuestions] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const [showSecurityQuestionsForm, setShowSecurityQuestionsForm] = useState(false);
  const [canChangeSecurityQuestions, setCanChangeSecurityQuestions] = useState(true);
  const [nextChangeDate, setNextChangeDate] = useState(null);

  const [mode, setMode] = useState(null);
  const [value, setValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [activeMethod, setActiveMethod] = useState(null);

  useEffect(() => {
    if (user) {
      fetchConfig();
    } else {
      // If no user, stop loading and show an error
      setLoading(false);
      setError("User not authenticated. Please log in.");
    }
  }, [user]);

  const fetchConfig = async () => {
    try {
      setLoading(true); // Ensure loading is true at the start of fetch
      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data.config;
      setConfig(cfg);

      if (cfg.securityQuestions && cfg.securityQuestions.length > 0) {
        setSecurityQuestions(cfg.securityQuestions.map(q => ({ question: q.question, answer: "" })));
      }

      if (cfg.securityQuestionsLastUpdatedAt) {
        const lastUpdated = new Date(cfg.securityQuestionsLastUpdatedAt);
        const sixMonthsLater = new Date(lastUpdated.setMonth(lastUpdated.getMonth() + 6));
        const now = new Date();

        if (now < sixMonthsLater) {
          setCanChangeSecurityQuestions(false);
          setNextChangeDate(sixMonthsLater);
        } else {
          setCanChangeSecurityQuestions(true);
          setNextChangeDate(null);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching security config:", err);
      setError("Failed to fetch security settings.");
      setLoading(false);
    }
  };

  const handleToggle = async (method) => {
    const isEnabled = config?.[`${method}Enabled`];

    if (isEnabled) {
      // Logic for disabling a method
      try {
        setIsSaving(true); // Start saving indicator
        const updated = { userId: user.uid };
        updated[`${method}Enabled`] = false;
        
        // When disabling biometric, also clear its credentials
        if (method === "biometric") {
          updated.biometricCredentials = [];
        }

        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setSuccessMessage(`${method.charAt(0).toUpperCase() + method.slice(1)} has been disabled.`);
        setError(""); // Clear any previous errors
      } catch (err) {
        console.error(`Failed to disable ${method}:`, err);
        setError(`Failed to disable ${method}.`);
        setSuccessMessage(""); // Clear any previous success messages
      } finally {
        setIsSaving(false); // End saving indicator
      }
      return;
    }

    // Logic for enabling a method
    if (method === "biometric") {
      try {
        setIsSaving(true);
        setError("");
        setSuccessMessage("");

        // Check for WebAuthn support
        if (!window.PublicKeyCredential) {
          throw new Error("WebAuthn (Biometric) is not supported in this browser or environment (requires HTTPS).");
        }

        // Generate a challenge from the server for registration
        // In a real app, this would be a fetch to your backend to get a challenge
        // For this example, we'll use a dummy challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyCredentialCreationOptions = {
          challenge: challenge,
          rp: { name: "Wealth Management App", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user.uid),
            name: user.email || user.uid,
            displayName: user.email || user.uid,
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }], // ES256, RS256
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Use platform authenticators (e.g., built-in fingerprint)
            userVerification: "required", // Require biometric verification
          },
          timeout: 60000,
          attestation: "none",
        };

        const credential = await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions,
        });

        // Extract credential data and convert to Base64Url for storage
        const credentialID = arrayBufferToBase64url(credential.rawId);
        // Note: credential.response.getPublicKey() returns an ArrayBuffer.
        // It needs to be converted to Base64Url for storage in your string schema field.
        const publicKey = arrayBufferToBase64url(credential.response.getPublicKey().buffer);
        const transports = credential.response.getTransports(); // Get transports if available

        const newBiometricCredential = {
          credentialID: credentialID,
          publicKey: publicKey,
          counter: 0, // Initial counter, should be managed by backend during assertion
          transports: transports || [],
        };

        const updated = {
          userId: user.uid,
          biometricEnabled: true,
          // IMPORTANT FIX: Include the new biometric credential in the array
          biometricCredentials: [...(config?.biometricCredentials || []), newBiometricCredential],
          pinEnabled: false,
          passwordEnabled: false,
          patternEnabled: false,
        };
        // Remove biometricHash as it's not used for WebAuthn
        delete updated.biometricHash; 

        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setSuccessMessage("Biometric authentication enabled successfully!");
      } catch (err) {
        console.error("Failed to enable biometric authentication:", err);
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
          setError("Biometric setup cancelled or denied by user.");
        } else if (err.message.includes("supported")) {
          setError(err.message);
        } else {
          setError("Failed to enable biometric authentication. Ensure your device has a biometric sensor configured and try again on HTTPS.");
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // For PIN, Password, Pattern
    setMode(method);
    setActiveMethod(method);
    setValue("");
    setConfirmValue("");
    setPattern([]);
    setConfirmPattern([]);
    setError("");
    setSuccessMessage("");
  };

  const handleSubmit = async () => {
    const method = activeMethod;

    if (!user || !user.uid) {
      setError("User not authenticated. Cannot save settings.");
      return;
    }

    setIsSaving(true); // Start saving indicator

    try {
      if (method === "pattern") {
        // Validate pattern length before submission
        if (pattern.length < 3 || confirmPattern.length < 3) {
          setError("Pattern must connect at least 3 dots.");
          setIsSaving(false); // End saving indicator if validation fails
          return;
        }

        if (JSON.stringify(pattern) !== JSON.stringify(confirmPattern)) {
          setError("Patterns do not match.");
          setIsSaving(false); // End saving indicator if validation fails
          return;
        }

        // Dynamically import bcryptjs
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.hash(JSON.stringify(pattern), 10);
        const updated = {
          userId: user.uid,
          patternHash: hash,
          patternEnabled: true,
          pinEnabled: false,
          passwordEnabled: false,
          biometricEnabled: false, // Disable other methods
          biometricCredentials: [], // Clear biometric credentials when another method is set
        };
        // Remove biometricHash as it's not used for WebAuthn
        delete updated.biometricHash; 

        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setPattern([]);
        setConfirmPattern([]);
        setMode(null);
        setSuccessMessage("Pattern has been set successfully.");
        setError("");
      } else { // For PIN and Password
        const trimmedValue = value.trim();
        const trimmedConfirm = confirmValue.trim();

        if (!trimmedValue || !trimmedConfirm) {
          setError("Both fields are required.");
          setIsSaving(false); // End saving indicator if validation fails
          return;
        }

        if (trimmedValue !== trimmedConfirm) {
          setError("Values do not match.");
          setIsSaving(false); // End saving indicator if validation fails
          return;
        }

        if (method === "pin" && !/^\d{6}$/.test(trimmedValue)) {
          setError("PIN must be exactly 6 digits.");
          setIsSaving(false); // End saving indicator if validation fails
          return;
        }

        if (method === "password" && !/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/.test(trimmedValue)) {
          setError("Password must be at least 6 characters, include a capital letter, a digit, and a special character.");
          setIsSaving(false); // End saving indicator if validation fails
          return;
        }

        // Dynamically import bcryptjs
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.hash(trimmedValue, 10);
        const updated = { userId: user.uid };
        updated[`${method}Hash`] = hash;
        updated[`${method}Enabled`] = true;

        const otherMethods = ["pin", "password", "pattern", "biometric"].filter(m => m !== method); // Include biometric
        otherMethods.forEach(m => updated[`${m}Enabled`] = false);
        // Clear biometric credentials if another method is chosen
        if (method !== "biometric") {
          updated.biometricCredentials = [];
        }
        // Remove biometricHash as it's not used for WebAuthn
        delete updated.biometricHash; 

        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setMode(null);
        setValue("");
        setConfirmValue("");
        setSuccessMessage(`${method.charAt(0).toUpperCase() + method.slice(1)} has been set successfully.`);
        setError("");
      }
    } catch (err) {
      console.error("Failed to set authentication method:", err);
      setError("Failed to set authentication method.");
      setSuccessMessage("");
    } finally {
      setIsSaving(false); // End saving indicator
    }
  };

  const handleSecurityQuestionChange = (index, field, newValue) => {
    const newQuestions = [...securityQuestions];
    if (field === "question") {
      const selected = newQuestions.map((q) => q.question);
      if (selected.includes(newValue) && selected.indexOf(newValue) !== index) {
        setError("Each question must be unique.");
        return;
      }
    }
    newQuestions[index][field] = newValue;
    setSecurityQuestions(newQuestions);
    setError("");
  };

  const handleSaveSecurityQuestions = async () => {
    if (!user || !user.uid) {
      setError("User not authenticated. Cannot save security questions.");
      return;
    }

    setIsSaving(true); // Start saving indicator

    try {
      const hasEmptyFields = securityQuestions.some(q => !q.question || !q.answer.trim());
      if (hasEmptyFields) {
        setError("Please complete all questions and answers.");
        setIsSaving(false); // End saving indicator if validation fails
        return;
      }

      const unique = new Set(securityQuestions.map(q => q.question));
      if (unique.size !== 3) {
        setError("Please choose 3 different questions.");
        setIsSaving(false); // End saving indicator if validation fails
        return;
      }

      // Hash the answers before sending to the backend for security
      const bcrypt = await import("bcryptjs");
      const questionsWithHashedAnswers = await Promise.all(
        securityQuestions.map(async (q) => ({
          question: q.question,
          answerHash: await bcrypt.hash(q.answer.trim(), 10),
        }))
      );

      await axios.put(`${API}/security-questions/${user.uid}`, {
        questions: questionsWithHashedAnswers,
      });
      setSuccessMessage("Security questions updated successfully.");
      setShowSecurityQuestionsForm(false);
      setError("");
      fetchConfig(); // Re-fetch config to update last updated date and lock status
    } catch (err) {
      console.error("Failed to save security questions:", err);
      setError("Failed to save security questions.");
      setSuccessMessage("");
    } finally {
      setIsSaving(false); // End saving indicator
    }
  };

  // Render a loading spinner with a message if the component is still loading
  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" role="status" className="mb-3" />
        <p className="text-muted">Loading security settings...</p>
      </div>
    );
  }

  return (
    <Card className="p-4 shadow-sm my-4 mx-auto" style={{ maxWidth: "600px" }}>
      <h3 className="mb-3 text-center">Security Settings</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="g-3">
        {["pin", "password", "pattern", "biometric"].map((method) => ( // Added "biometric"
          <Col xs={12} md={4} key={method}>
            <Form.Check
              type="switch"
              label={`Enable ${method.charAt(0).toUpperCase() + method.slice(1)}`}
              checked={config?.[`${method}Enabled`] || false}
              onChange={() => handleToggle(method)}
              id={`${method}-switch`} // Added unique id for accessibility
              disabled={isSaving} // Disable toggle while saving
            />
          </Col>
        ))}

        {mode === "pin" && (
          <Col xs={12}>
            <Card className="p-3">
              <h5>Set a 6-digit PIN</h5>
              <Form.Control
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit PIN"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-2"
                maxLength={6} // Ensure only 6 digits can be entered
                disabled={isSaving} // Disable input while saving
              />
              <Form.Control
                type="text"
                inputMode="numeric"
                placeholder="Confirm 6-digit PIN"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                className="mt-2"
                maxLength={6} // Ensure only 6 digits can be entered
                disabled={isSaving} // Disable input while saving
              />
              <Button onClick={handleSubmit} className="mt-3 w-100" disabled={isSaving}>
                {isSaving && activeMethod === "pin" ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Saving...
                  </>
                ) : (
                  "Save PIN"
                )}
              </Button>
            </Card>
          </Col>
        )}

        {mode === "password" && (
          <Col xs={12}>
            <Card className="p-3">
              <h5>Set a Strong Password</h5>
              <Form.Control
                type="password"
                placeholder="Enter Password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-2"
                disabled={isSaving} // Disable input while saving
              />
              <Form.Control
                type="password"
                placeholder="Confirm Password"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                className="mt-2"
                disabled={isSaving} // Disable input while saving
              />
              <Button onClick={handleSubmit} className="mt-3 w-100" disabled={isSaving}>
                {isSaving && activeMethod === "password" ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Saving...
                  </>
                ) : (
                  "Save Password"
                )}
              </Button>
            </Card>
          </Col>
        )}

        {mode === "pattern" && (
          <Col xs={12}>
            <Card className="p-3 text-center">
              <h5>Draw and Confirm Your Pattern</h5>
              <div className="mt-3 p-3 bg-light rounded">
                <p className="fw-semibold">Draw Pattern</p>
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
                />
              </div>
              <div className="mt-4 p-3 bg-light rounded">
                <p className="fw-semibold">Confirm Pattern</p>
                <PatternLock
                  width={250}
                  size={3}
                  path={confirmPattern}
                  onChange={(pts) => setConfirmPattern(pts || [])}
                  onFinish={() => {
                    if (confirmPattern.length < 3) {
                      setError("Confirm pattern must connect at least 3 dots.");
                    } else {
                      setError("");
                    }
                  }}
                />
              </div>
              <Button className="mt-4 w-100" onClick={handleSubmit} disabled={isSaving}>
                {isSaving && activeMethod === "pattern" ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Saving...
                  </>
                ) : (
                  "Save Pattern"
                )}
              </Button>
            </Card>
          </Col>
        )}
      </Row>

      <hr className="my-4" />
      <h4 className="text-center">Security Questions</h4>

      {config?.securityQuestionsLastUpdatedAt && !canChangeSecurityQuestions && (
        <Alert variant="info" className="text-center">
          You can update your security questions again on {nextChangeDate ? format(nextChangeDate, "PPP") : "N/A"}.
        </Alert>
      )}

      <div className="d-grid gap-2">
        <Button
          variant="primary"
          disabled={!canChangeSecurityQuestions || isSaving} // Disable button while saving
          onClick={() => {
            setShowSecurityQuestionsForm(!showSecurityQuestionsForm);
            setError("");
            setSuccessMessage("");
          }}
        >
          {showSecurityQuestionsForm ? "Hide Questions Form" : "Set/Update Security Questions"}
        </Button>
      </div>

      {showSecurityQuestionsForm && (
        <Form className="mt-3">
          {securityQuestions.map((q, idx) => (
            <div key={idx} className="mb-3">
              <Form.Group>
                <Form.Label>Question {idx + 1}</Form.Label>
                <Dropdown className="mb-2">
                  <Dropdown.Toggle className="w-100" variant="outline-secondary" disabled={isSaving}>
                    {q.question || "Choose a question"}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {FIXED_SECURITY_QUESTIONS.map((fixedQ, i) => (
                      <Dropdown.Item
                        key={i}
                        disabled={securityQuestions.some((sq, j) => j !== idx && sq.question === fixedQ) || isSaving}
                        onClick={() => handleSecurityQuestionChange(idx, "question", fixedQ)}
                      >
                        {fixedQ}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Group>
              <Form.Control
                type="text"
                placeholder="Enter your answer"
                value={q.answer}
                onChange={(e) => handleSecurityQuestionChange(idx, "answer", e.target.value)}
                disabled={isSaving} // Disable input while saving
              />
            </div>
          ))}
          <Button className="w-100 mt-3" onClick={handleSaveSecurityQuestions} disabled={isSaving}>
            {isSaving && showSecurityQuestionsForm ? ( // Check if saving and security questions form is active
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Saving...
              </>
            ) : (
              "Save Security Questions"
            )}
          </Button>
        </Form>
      )}
    </Card>
  );
};

export default SecuritySettings;
