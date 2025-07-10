import React, { useEffect, useState, useRef } from "react";
import { Button, Card, Form, Row, Col, Spinner, Alert, Dropdown } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import bcrypt from "bcryptjs";
import PatternLock from "react-pattern-lock";
import { format } from 'date-fns'; // Import date-fns for easy date formatting

const API = "https://backend-pbmi.onrender.com/api/security-config"; // Ensure this is your backend URL

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

// Helper functions for ArrayBuffer to Base64URL string conversion
// These are simplified versions of what @simplewebauthn/browser provides
const toBase64URL = (buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64URL = (base64url) => {
  // Convert from base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Pad the string to a multiple of 4
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};


const SecuritySettings = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [value, setValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [pattern, setPattern] = useState([]);
  const [confirmPattern, setConfirmPattern] = useState([]);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [securityQuestions, setSecurityQuestions] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const [showSecurityQuestionsForm, setShowSecurityQuestionsForm] = useState(false);
  const [canChangeSecurityQuestions, setCanChangeSecurityQuestions] = useState(true);
  const [nextChangeDate, setNextChangeDate] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    if (user) {
            fetchConfig(true);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (mode.includes("pattern")) {
          setPattern([]);
          setConfirmPattern([]);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mode]);

  const fetchConfig = async (requireVerify = false) => {
    try {
      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data;
      setConfig(cfg);

      if (cfg.securityQuestions && cfg.securityQuestions.length > 0) {
        setSecurityQuestions(
          cfg.securityQuestions.map((q) => ({
            question: q.question,
            answer: "",
          }))
        );
      } else {
        setSecurityQuestions([
          { question: "", answer: "" },
          { question: "", answer: "" },
          { question: "", answer: "" },
        ]);
      }

      // Check cooldown for security questions
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
      } else {
        setCanChangeSecurityQuestions(true); // Can change if never set
        setNextChangeDate(null);
      }


      if (requireVerify) {
        if (cfg.patternEnabled) setMode("verify-pattern");
        else if (cfg.pinEnabled) setMode("verify-pin");
        else if (cfg.passwordEnabled) setMode("verify-password");
        else if (cfg.biometricEnabled) await tryBiometric(cfg); // Use await here
      }
      setError("");
      setSuccessMessage("");
    } catch (err) {
      if (err.response?.status === 404) {
        await axios.post(API, { userId: user.uid });
        fetchConfig(requireVerify);
      } else {
        console.error("Failed to fetch config", err);
        setError("Failed to load security settings.");
      }
    } finally {
      setLoading(false);
    }
  };

const tryBiometric = async (cfg) => {
  if (!window.PublicKeyCredential) {
    setError("Biometric authentication is not supported on this device. Please use another method.");
    fallback(cfg);
    return;
  }

  try {
    // ✅ FIXED: Use the correct endpoint for authentication
    const { data: options } = await axios.get(`${API}/biometric/generate-authentication-options/${user.uid}`);

    // Convert challenge and credential IDs from Base64URL to ArrayBuffer
    options.challenge = fromBase64URL(options.challenge);
    options.allowCredentials.forEach(cred => {
        cred.id = fromBase64URL(cred.id);
    });

    const authenticationResponse = await navigator.credentials.get({
      publicKey: options,
    });

    await axios.post(`${API}/biometric/verify`, {
      userId: user.uid,
      authenticationResponse: {
        id: authenticationResponse.id,
        rawId: toBase64URL(authenticationResponse.rawId),
        response: {
          authenticatorData: toBase64URL(authenticationResponse.response.authenticatorData),
          clientDataJSON: toBase64URL(authenticationResponse.response.clientDataJSON),
          signature: toBase64URL(authenticationResponse.response.signature),
          userHandle: authenticationResponse.response.userHandle ? toBase64URL(authenticationResponse.response.userHandle) : null,
        },
        type: authenticationResponse.type,
      },
    });

    setMode("");
    fetchConfig();
    setError("");
    setSuccessMessage("Biometric verification successful.");
  } catch (err) {
    console.error("Biometric authentication failed:", err);
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      setError("Biometric authentication cancelled or denied. Please try another method.");
    } else if (err.response?.data?.message) {
      setError(`Biometric authentication failed: ${err.response.data.message}`);
    } else {
      setError("Biometric authentication failed. Please use another method.");
    }
    fallback(cfg);
  }
};

  const fallback = (cfg) => {
    if (cfg.patternEnabled) setMode("verify-pattern");
    else if (cfg.pinEnabled) setMode("verify-pin");
    else if (cfg.passwordEnabled) setMode("verify-password");
    else {
      setError("No alternative verification method available.");
    }
  };

  const toggleMethod = async (method) => {
    if (!user) return;
    const enabling = !config[`${method}Enabled`];
    const allMethods = ["password", "pin", "pattern", "biometric"];
    const others = allMethods.filter((m) => m !== method);

    setError("");
    setSuccessMessage("");

    if (enabling) {
        if (method === "biometric") {
            if (!window.PublicKeyCredential) {
                setError("Biometric authentication is not supported on this device.");
                return;
            }
            try {
                // 1. Get registration options from backend
                const { data: options } = await axios.get(`${API}/biometric/generate-registration-options/${user.uid}`);

                // Convert challenge from Base64URL to ArrayBuffer
                options.challenge = fromBase64URL(options.challenge);
                options.user.id = fromBase64URL(options.user.id);
                options.excludeCredentials.forEach(cred => {
                    cred.id = fromBase64URL(cred.id);
                });

                // 2. Request biometric registration from the browser
                const attestationResponse = await navigator.credentials.create({
                    publicKey: options,
                });

                // 3. Send the registration response to backend for verification and saving
                await axios.post(`${API}/biometric/verify-registration/${user.uid}`, {
                    attestationResponse: {
                        id: attestationResponse.id,
                        rawId: toBase64URL(attestationResponse.rawId), // Convert to Base64URL
                        response: {
                            attestationObject: toBase64URL(attestationResponse.response.attestationObject),
                            clientDataJSON: toBase64URL(attestationResponse.response.clientDataJSON),
                        },
                        type: attestationResponse.type,
                    }
                });

                // If successful, update config and show success
                const update = { userId: user.uid };
                others.forEach((m) => (update[`${m}Enabled`] = false)); // Disable others
                update[`${method}Enabled`] = true; // Enable biometric
                await axios.put(`${API}/${user.uid}`, update); // Update the config on backend
                fetchConfig();
                setSuccessMessage("Biometric enabled and registered successfully!");

            } catch (err) {
                console.error("Biometric registration failed:", err);
                if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
                    setError("Biometric registration cancelled or denied.");
                } else if (err.response?.data?.message) {
                    setError(`Biometric registration failed: ${err.response.data.message}`);
                } else {
                    setError("Failed to enable biometric authentication.");
                }
                // If registration fails, ensure the switch is visually off and backend config is correct
                const update = { userId: user.uid };
                update[`${method}Enabled`] = false;
                try {
                    await axios.put(`${API}/${user.uid}`, update);
                    fetchConfig(); // Re-fetch to ensure UI reflects actual backend state
                } catch (e) {
                    console.error("Failed to revert biometric enable state:", e);
                }
            }
        } else {
            // Existing logic for password, pin, pattern
            setMode(`set-${method}`);
            const update = { userId: user.uid };
            others.forEach((m) => (update[`${m}Enabled`] = false));
            update[`${method}Enabled`] = false; // Temporarily disable until set
            try {
                await axios.put(`${API}/${user.uid}`, update);
                setConfig((prev) => ({ ...prev, ...update }));
            } catch (err) {
                console.error("Failed to disable other methods", err);
                setError("Failed to prepare for setting new method.");
            }
        }
    } else {
      // Disabling a method
      try {
        await axios.put(`${API}/${user.uid}`, {
          userId: user.uid,
          [`${method}Enabled`]: false,
        });
        fetchConfig();
        setError("");
        setSuccessMessage(`${method} disabled successfully.`);
      } catch (err) {
        console.error("Disable failed", err);
        setError(`Failed to disable ${method}.`);
      }
    }
  };

  const handleSubmit = async () => {
    if (!mode) return;

    setError("");
    setSuccessMessage("");
    let methodType = "";
    let rawValue = value;

    if (mode.startsWith("verify")) {
      methodType = mode.split("-")[1];
      rawValue = methodType === "pattern" ? pattern.join("") : value;

      try {
        await axios.post(`${API}/verify`, {
          userId: user.uid,
          value: rawValue,
          method: methodType,
        });
        setValue("");
        setPattern([]);
        setMode("");
        fetchConfig();
        setError("");
        setSuccessMessage(`${methodType} verification successful.`);
      } catch (err) {
        setError("Invalid " + methodType + ". Please try again.");
        setValue("");
        setPattern([]);
      }
      return;
    }

    if (mode.startsWith("set-") || mode.startsWith("reset-")) {
      methodType = mode.split("-")[1];
      let inputValue = methodType === "pattern" ? pattern.join("") : value;
      let confirmInputValue = methodType === "pattern" ? confirmPattern.join("") : confirmValue;

      if (inputValue !== confirmInputValue) {
        setError("Confirmation does not match. Please re-enter.");
        return;
      }
    }

    if (!methodType) methodType = mode.split("-")[1];

    const hashed = await bcrypt.hash(
      methodType === "pattern" ? pattern.join("") : value,
      10
    );

    const update = { userId: user.uid };

    if (mode === "set-password") {
      update.passwordHash = hashed;
      update.passwordEnabled = true;
    } else if (mode === "set-pin") {
      update.pinHash = hashed;
      update.pinEnabled = true;
    } else if (mode === "set-pattern") {
      update.patternHash = hashed;
      update.patternEnabled = true;
    } else if (mode === "reset-password") {
      update.passwordHash = hashed;
    } else if (mode === "reset-pin") {
      update.pinHash = hashed;
    } else if (mode === "reset-pattern") {
      update.patternHash = hashed;
    }

    try {
      await axios.put(`${API}/${user.uid}`, update);
      setValue("");
      setConfirmValue("");
      setPattern([]);
      setConfirmPattern([]);
      setMode("");
      fetchConfig();
      setError("");
      setSuccessMessage(`${methodType} updated successfully.`);
    } catch (err) {
      console.error("Update failed", err);
      setError("Failed to update security setting.");
    }
  };

  const handleSecurityQuestionChange = (index, field, newValue) => {
    const newQuestions = [...securityQuestions];
    if (field === "question") {
      const selectedQuestions = newQuestions.map(q => q.question);
      if (selectedQuestions.includes(newValue) && selectedQuestions.indexOf(newValue) !== index) {
        setError("This question has already been selected. Please choose a unique question.");
        return;
      }
    }
    newQuestions[index][field] = newValue;
    setSecurityQuestions(newQuestions);
    setError("");
  };

  const handleSaveSecurityQuestions = async () => {
    setError("");
    setSuccessMessage("");

    const hasEmptyFields = securityQuestions.some(
      (q) => !q.question.trim() || !q.answer.trim()
    );
    if (hasEmptyFields) {
      setError("Please select all 3 questions and provide answers.");
      return;
    }

    const uniqueQuestions = new Set(securityQuestions.map(q => q.question));
    if (uniqueQuestions.size !== 3) {
        setError("Please select 3 unique security questions.");
        return;
    }

    try {
      await axios.put(`${API}/security-questions/${user.uid}`, {
        questions: securityQuestions,
      });
      fetchConfig();
      setSuccessMessage("Security questions saved successfully!");
      setShowSecurityQuestionsForm(false);
    } catch (err) {
      console.error("Failed to save security questions", err);
      setError("Failed to save security questions. Please try again.");
    }
  };

  if (loading || !config)
    return <Spinner animation="border" className="d-block mx-auto mt-5" />;

  const isSettingNewMethod = mode.startsWith("set-") || mode.startsWith("reset-");

  return (
    <Card className="p-4 shadow-sm my-4 mx-auto" style={{ maxWidth: "500px" }}>
      <h3 className="mb-3 text-center">Security Settings</h3>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="mb-3 g-2">
        <Col xs={12} md={6}>
          <Form.Check
            type="switch"
            id="pin-switch"
            label="Enable PIN"
            checked={config.pinEnabled}
            onChange={() => toggleMethod("pin")}
            className="mb-2"
          />
        </Col>
        <Col xs={12} md={6}>
          <Form.Check
            type="switch"
            id="password-switch"
            label="Enable Password"
            checked={config.passwordEnabled}
            onChange={() => toggleMethod("password")}
            className="mb-2"
          />
        </Col>
        <Col xs={12} md={6}>
          <Form.Check
            type="switch"
            id="pattern-switch"
            label="Enable Pattern"
            checked={config.patternEnabled}
            onChange={() => toggleMethod("pattern")}
            className="mb-2"
          />
        </Col>
        <Col xs={12} md={6}>
          <Form.Check
            type="switch"
            id="biometric-switch"
            label="Enable Biometric"
            checked={config.biometricEnabled}
            onChange={() => toggleMethod("biometric")}
            className="mb-2"
          />
        </Col>
      </Row>

      {mode && (
        <Form className="mt-3">
          <div ref={containerRef}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">
                {mode === "reset-password"
                  ? "Enter New Password"
                  : mode === "set-password"
                  ? "Set New Password"
                  : mode.includes("verify-password")
                  ? "Enter Password to Continue"
                  : mode === "set-pin"
                  ? "Set New PIN"
                  : mode.includes("verify-pin")
                  ? "Enter PIN to Continue"
                  : mode === "set-pattern"
                  ? "Set New Pattern"
                  : mode.includes("verify-pattern")
                  ? "Draw Pattern to Continue"
                  : "Verify"}
              </Form.Label>

              {mode.includes("pattern") ? (
                <div className="d-flex justify-content-center mb-3">
                  <div
                    style={{
                      background: "#f0f0f0",
                      padding: "10px",
                      display: "inline-block",
                      borderRadius: "8px",
                    }}
                  >
                    <PatternLock
                      width={240}
                      size={3}
                      path={pattern}
                      onChange={(p) => {
                        setPattern(p);
                        setError("");
                      }}
                      onFinish={() => {}}
                      visible
                      activeColor="black"
                      dotColor="black"
                      lineColor="black"
                    />
                  </div>
                </div>
              ) : (
                <Form.Control
                  type={mode.includes("password") ? "password" : "text"}
                  inputMode={mode.includes("pin") ? "numeric" : undefined}
                  pattern={mode.includes("pin") ? "[0-9]*" : undefined}
                  value={value}
                  onChange={(e) => {
                    setValue(
                      mode.includes("pin")
                        ? e.target.value.replace(/\D/g, "")
                        : e.target.value
                    );
                    setError("");
                  }}
                  placeholder={
                    mode.includes("password") ? "Enter password" : "Enter PIN"
                  }
                  className="mb-2"
                />
              )}
            </Form.Group>

            {isSettingNewMethod && (
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  {mode.includes("password")
                    ? "Confirm New Password"
                    : mode.includes("pin")
                    ? "Confirm New PIN"
                    : "Confirm New Pattern"}
                </Form.Label>
                {mode.includes("pattern") ? (
                  <div className="d-flex justify-content-center mb-3">
                    <div
                      style={{
                        background: "#f0f0f0",
                        padding: "10px",
                        display: "inline-block",
                        borderRadius: "8px",
                      }}
                    >
                      <PatternLock
                        width={240}
                        size={3}
                        path={confirmPattern}
                        onChange={(p) => {
                          setConfirmPattern(p);
                          setError("");
                        }}
                        onFinish={() => {}}
                        visible
                        activeColor="black"
                        dotColor="black"
                        lineColor="black"
                      />
                    </div>
                  </div>
                ) : (
                  <Form.Control
                    type={mode.includes("password") ? "password" : "text"}
                    inputMode={mode.includes("pin") ? "numeric" : undefined}
                    pattern={mode.includes("pin") ? "[0-9]*" : undefined}
                    value={confirmValue}
                    onChange={(e) => {
                      setConfirmValue(
                        mode.includes("pin")
                          ? e.target.value.replace(/\D/g, "")
                          : e.target.value
                      );
                      setError("");
                    }}
                    placeholder={
                      mode.includes("password") ? "Confirm password" : "Confirm PIN"
                    }
                  />
                )}
              </Form.Group>
            )}

            <Button className="w-100 mt-2" onClick={handleSubmit}>
              Submit
            </Button>
          </div>
        </Form>
      )}

      {config.passwordEnabled && (
        <div className="mt-4 d-flex flex-column flex-md-row gap-2">
          <Button
            variant="secondary"
            className="flex-grow-1"
            onClick={() => {
              setMode("reset-password");
              setError("");
              setSuccessMessage("");
              setValue("");
              setConfirmValue("");
            }}
          >
            Reset Password
          </Button>
          <Button
            variant="warning"
            className="flex-grow-1"
            onClick={() => {
              setMode("set-password");
              setError("");
              setSuccessMessage("");
              setValue("");
              setConfirmValue("");
            }}
          >
            Change Password
          </Button>
        </div>
      )}

      {config.pinEnabled && (
        <div className="mt-4 d-flex flex-column flex-md-row gap-2">
          <Button
            variant="warning"
            className="flex-grow-1"
            onClick={() => {
              setMode("set-pin");
              setError("");
              setSuccessMessage("");
              setValue("");
              setConfirmValue("");
            }}
          >
            Change PIN
          </Button>
        </div>
      )}

      {config.patternEnabled && (
        <div className="mt-4 d-flex flex-column flex-md-row gap-2">
          <Button
            variant="warning"
            className="flex-grow-1"
            onClick={() => {
              setMode("set-pattern");
              setError("");
              setSuccessMessage("");
              setPattern([]);
              setConfirmPattern([]);
            }}
          >
            Change Pattern
          </Button>
        </div>
      )}

      <hr className="my-4" />
      <h4 className="mb-3 text-center">Security Questions</h4>

      {config.securityQuestionsLastUpdatedAt && !canChangeSecurityQuestions && (
        <Alert variant="info" className="text-center">
          Security questions can only be changed once every 6 months.
          Next available: {nextChangeDate ? format(nextChangeDate, 'PPP') : 'N/A'}
        </Alert>
      )}

      <div className="d-grid gap-2">
        <Button
          variant="info"
          onClick={() => {
            setShowSecurityQuestionsForm(!showSecurityQuestionsForm);
            setError("");
            setSuccessMessage("");
            if (!showSecurityQuestionsForm) {
                setSecurityQuestions(
                    config.securityQuestions && config.securityQuestions.length > 0
                        ? config.securityQuestions.map(q => ({ question: q.question, answer: "" }))
                        : [{ question: "", answer: "" }, { question: "", answer: "" }, { question: "", answer: "" }]
                );
            }
          }}
          disabled={!canChangeSecurityQuestions} // Disable if within cooldown period
        >
          {showSecurityQuestionsForm ? "Hide Security Questions Form" : "Set/Update Security Questions"}
        </Button>
      </div>

      {showSecurityQuestionsForm && (
        <Form className="mt-3">
          <p className="text-muted text-center">
            Set 3 unique security questions and their answers.
          </p>
          {securityQuestions.map((q, index) => (
            <div key={index} className="mb-3">
              <Form.Group className="mb-2">
                <Form.Label className="fw-bold">Question {index + 1}</Form.Label>
                <Dropdown className="w-100">
                  <Dropdown.Toggle variant="outline-primary" id={`dropdown-question-${index}`} className="w-100 text-start">
                    {q.question || "Select a question"}
                  </Dropdown.Toggle>

                  <Dropdown.Menu className="w-100">
                    {FIXED_SECURITY_QUESTIONS.map((fixedQ, idx) => (
                      <Dropdown.Item
                        key={idx}
                        onClick={() => handleSecurityQuestionChange(index, "question", fixedQ)}
                        active={q.question === fixedQ}
                        disabled={securityQuestions.some((item, i) => i !== index && item.question === fixedQ)}
                      >
                        {fixedQ}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Group>
              <Form.Group>
                <Form.Label className="fw-bold">Answer {index + 1}</Form.Label>
                <Form.Control
                  type="password"
                  placeholder={`Enter answer for question ${index + 1}`}
                  value={q.answer}
                  onChange={(e) =>
                    handleSecurityQuestionChange(index, "answer", e.target.value)
                  }
                />
              </Form.Group>
            </div>
          ))}
          <Button className="w-100 mt-3" onClick={handleSaveSecurityQuestions}>
            Save Security Questions
          </Button>
        </Form>
      )}
    </Card>
  );
};

export default SecuritySettings;
