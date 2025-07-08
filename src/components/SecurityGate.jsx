import React, { useEffect, useState } from "react";
import { Modal, Form, Button, Spinner, Alert, Dropdown } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import PatternLock from "react-pattern-lock";

const API = "https://backend-pbmi.onrender.com/api/security-config";

// Define the same fixed list of security questions
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

const SecurityGate = ({ children }) => {
  const [user, userLoading] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentAuthMethod, setCurrentAuthMethod] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [pattern, setPattern] = useState([]);
  const [biometricSupported, setBiometricSupported] = useState(false);

  // State for Forgot Password flow
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordChoice, setForgotPasswordChoice] = useState(null); // 'email' or 'security_questions'
  const [emailSentMessage, setEmailSentMessage] = useState(''); // Message after sending email

  // New states for Email Reset - Token Entry
  const [showTokenEntryForm, setShowTokenEntryForm] = useState(false); // Controls visibility of token/new value inputs
  const [emailTokenInput, setEmailTokenInput] = useState('');
  const [newMethodValueInput, setNewMethodValueInput] = useState('');
  // NEW STATE: To remember which method is being reset during the recovery flow,
  // especially when coming back to the modal after an email has been sent.
  const [methodToResetInRecovery, setMethodToResetInRecovery] = useState(null);


  const [securityQuestionsData, setSecurityQuestionsData] = useState([]); // Stores { question: string }
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answerToQuestion, setAnswerToQuestion] = useState("");

  useEffect(() => {
    if (!userLoading && user) {
      fetchConfig();

      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          fetchConfig();
        }
      };

      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    } else if (!userLoading && !user) {
      setLoading(false);
      setShowModal(false);
    }
  }, [user, userLoading]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/${user.uid}`);
      const cfg = res.data;
      setConfig(cfg);

      const biometricAvailable = !!window.PublicKeyCredential && typeof window.PublicKeyCredential.prototype.isUserVerifyingPlatformAuthenticatorAvailable === "function" && await window.PublicKeyCredential.prototype.isUserVerifyingPlatformAuthenticatorAvailable();
      setBiometricSupported(biometricAvailable);

      let chosenMethod = null;
      if (cfg.biometricEnabled && biometricAvailable) {
        chosenMethod = "biometric";
        tryBiometric(cfg);
      } else if (cfg.patternEnabled) {
        chosenMethod = "pattern";
      } else if (cfg.passwordEnabled) {
        chosenMethod = "password";
      } else if (cfg.pinEnabled) {
        chosenMethod = "pin";
      }

      setCurrentAuthMethod(chosenMethod);
      setError("");

      // --- MODIFIED LOGIC: Check for active reset token and auto-show token form ---
      const hasActiveResetToken = cfg.passwordResetToken && cfg.passwordResetTokenExpiry && new Date(cfg.passwordResetTokenExpiry) > new Date();

      if (hasActiveResetToken) {
          // If there's an active token, automatically jump to the token entry form
          setShowModal(true); // Ensure modal is open
          setForgotPasswordMode(true);
          setForgotPasswordChoice('email');
          setShowTokenEntryForm(true);
          // Set the method that was likely intended for reset (the currently active one for login)
          setMethodToResetInRecovery(chosenMethod); //
          setEmailSentMessage("A reset code was previously sent to your email. Please enter it below to continue."); // Inform user
      } else if (chosenMethod && chosenMethod !== "biometric") {
          setShowModal(true); // Standard login flow
      } else if (!chosenMethod) {
          setShowModal(false); // No method set, gate not needed
      }

      // Reset all forgot password/reset states when re-fetching config,
      // UNLESS an active reset token was just detected and the form is shown.
      if (!hasActiveResetToken) {
          setForgotPasswordMode(false);
          setForgotPasswordChoice(null);
          setEmailSentMessage('');
          setShowTokenEntryForm(false);
          setEmailTokenInput('');
          setNewMethodValueInput('');
          setPattern([]); // Clear pattern for reset flow
          setInputValue(""); // Clear input value for main login
          setMethodToResetInRecovery(null); // Reset this too
      }
    } catch (err) {
      console.error("Error loading security config", err);
      setError("Failed to load security configuration. Please try again.");
      setCurrentAuthMethod(null);
      setShowModal(false);
      // Ensure all related states are reset on error
      setForgotPasswordMode(false);
      setForgotPasswordChoice(null);
      setEmailSentMessage('');
      setShowTokenEntryForm(false);
      setEmailTokenInput('');
      setNewMethodValueInput('');
      setPattern([]);
      setInputValue("");
      setMethodToResetInRecovery(null);
    } finally {
      setLoading(false);
    }
  };

  const tryBiometric = async (cfg) => {
    if (!biometricSupported) {
      setError("Biometric authentication is not supported on this device.");
      fallbackToOtherAuth(cfg);
      return;
    }
    try {
      setError("");
      const result = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          userVerification: "preferred",
        },
      });

      if (result) {
        await axios.post(`${API}/verify`, {
          userId: user.uid,
          method: "biometric",
        });
        setShowModal(false);
        setError("");
      } else {
        setError("Biometric authentication failed.");
        fallbackToOtherAuth(cfg);
      }
    } catch (err) {
      console.error("Biometric API error:", err);
      setError("Biometric authentication failed or cancelled.");
      fallbackToOtherAuth(cfg);
    }
  };

  const fallbackToOtherAuth = (cfg) => {
    if (cfg.patternEnabled) {
      setCurrentAuthMethod("pattern");
    } else if (cfg.passwordEnabled) {
      setCurrentAuthMethod("password");
    } else if (cfg.pinEnabled) {
      setCurrentAuthMethod("pin");
    } else {
      setCurrentAuthMethod(null);
      setShowModal(false);
      setError("No alternative authentication method available or enabled.");
      return;
    }
    setShowModal(true);
  };

  const handleVerify = async () => {
    setError("");
    if (!currentAuthMethod) {
      setError("No authentication method selected.");
      return;
    }

    try {
      const verifyValue = currentAuthMethod === "pattern" ? pattern.join("") : inputValue;
      const res = await axios.post(`${API}/verify`, {
        userId: user.uid,
        value: verifyValue,
        method: currentAuthMethod,
      });
      if (res.data.success) {
        setShowModal(false);
        setError("");
        setInputValue("");
        setPattern([]);
        setForgotPasswordMode(false); // Reset forgot password mode when re-authenticating
        setForgotPasswordChoice(null);
        setEmailSentMessage('');
        setShowTokenEntryForm(false);
        setEmailTokenInput('');
        setNewMethodValueInput('');
        setMethodToResetInRecovery(null); // Reset this too
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      if (err.response && err.response.status === 401) {
        setError("Invalid " + currentAuthMethod + ". Please try again.");
      } else {
        setError("An error occurred during verification. Please try again.");
      }
      setInputValue("");
      setPattern([]);
    }
  };

  const handleForgotPasswordClick = async () => {
    setError("");
    setInputValue("");
    setPattern([]);
    setAnswerToQuestion("");
    setSelectedQuestion("");
    setEmailSentMessage(""); // Clear previous email messages
    setEmailTokenInput(''); // Clear token input
    setNewMethodValueInput(''); // Clear new value input
    setMethodToResetInRecovery(null); // Reset this

    // Go to the mode where user chooses between email reset or security questions
    setForgotPasswordMode(true);
    setForgotPasswordChoice(null); // Reset choice
    setShowTokenEntryForm(false); // Hide token entry form initially
  };

  const handleRequestEmailReset = async () => {
    setError("");
    setEmailSentMessage("");
    if (!user || !user.uid || !user.email) {
        setError("User information not available for email reset.");
        return;
    }

    try {
        const res = await axios.post(`${API}/request-method-reset`, {
            userId: user.uid,
            email: user.email, // Use the user's authenticated email (Firebase email)
            methodToReset: currentAuthMethod, // The method they are trying to reset
        });

        if (res.data.success) {
            setEmailSentMessage(res.data.message || `A reset code has been sent to your email (${user.email}). Please check your inbox.`);
            setError(""); // Clear any previous errors
            setShowTokenEntryForm(true); // Now show the token entry form
            setMethodToResetInRecovery(currentAuthMethod); // Store which method was requested for reset
        } else {
            setError(res.data.message || "Failed to send reset email. Please try again.");
        }
    } catch (err) {
        console.error("Error requesting email reset:", err);
        setError(err.response?.data?.message || "An error occurred while requesting email reset. Please try again.");
    }
  };

  const handleResetMethodWithToken = async () => {
    setError("");
    if (!emailTokenInput || !newMethodValueInput) {
        setError("Please enter both the reset code and your new value.");
        return;
    }

    // Use methodToResetInRecovery to determine input type for the new value,
    // fallback to currentAuthMethod if methodToResetInRecovery somehow isn't set.
    const methodForReset = methodToResetInRecovery || currentAuthMethod;

    // Determine the raw value for pattern if applicable
    const valueToSend = methodForReset === "pattern" ? pattern.join("") : newMethodValueInput;

    try {
        const res = await axios.post(`${API}/reset-method-with-token`, {
            userId: user.uid,
            token: emailTokenInput, // The token from the email
            methodType: methodForReset, // The method being reset (password, pin, pattern)
            newValue: valueToSend, // The new PIN/Password/Pattern
        });

        if (res.data.success) {
            setError("");
            setEmailSentMessage(`${methodForReset} has been reset successfully!`);
            setShowModal(false); // <--- Gate unlocked!
            // Reset all related states
            setInputValue("");
            setPattern([]);
            setForgotPasswordMode(false);
            setForgotPasswordChoice(null);
            setShowTokenEntryForm(false);
            setEmailTokenInput('');
            setNewMethodValueInput('');
            setMethodToResetInRecovery(null); // Clear this
            // Re-fetch config to ensure UI is updated and gate logic re-evaluates
            fetchConfig();
        } else {
            setError(res.data.message || `Failed to reset ${methodForReset}.`);
        }
    } catch (err) {
        console.error("Error resetting method with token:", err);
        setError(err.response?.data?.message || `An error occurred while resetting ${methodForReset}. Please try again.`);
    }
  };


  const handleVerifySecurityAnswer = async () => {
    setError("");
    if (!selectedQuestion || !answerToQuestion.trim()) {
      setError("Please select a question and provide an answer.");
      return;
    }

    try {
      const res = await axios.post(`${API}/verify-security-answer`, {
        userId: user.uid,
        question: selectedQuestion,
        answer: answerToQuestion,
      });
      if (res.data.success) {
        setShowModal(false); // Gate unlocked
        setError("");
        setInputValue("");
        setPattern([]);
        setForgotPasswordMode(false);
        setForgotPasswordChoice(null);
        setSelectedQuestion("");
        setAnswerToQuestion("");
        setEmailSentMessage('');
        setShowTokenEntryForm(false);
        setEmailTokenInput('');
        setNewMethodValueInput('');
        setMethodToResetInRecovery(null); // Reset this too
      } else {
        setError("Incorrect answer. Please try again.");
      }
    } catch (err) {
      console.error("Security answer verification error:", err);
      setError("Failed to verify security answer. Please try again.");
    }
  };

  if (userLoading || loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (!currentAuthMethod && !showModal) {
    return <>{children}</>;
  }

  return (
    <>
      <Modal
        show={showModal}
        backdrop="static"
        keyboard={false}
        centered
        onHide={() => {
          // This onHide is technically not called if backdrop="static"
          // but good practice to keep states clean if it were.
          setInputValue("");
          setPattern([]);
          setError("");
          setForgotPasswordMode(false);
          setForgotPasswordChoice(null);
          setEmailSentMessage('');
          setShowTokenEntryForm(false);
          setEmailTokenInput('');
          setNewMethodValueInput('');
          setMethodToResetInRecovery(null); // Reset this too
        }}
      >
        <Modal.Header>
          <Modal.Title className="text-center w-100">
            {forgotPasswordMode
              ? (forgotPasswordChoice === 'email' ? "Email Reset" : (forgotPasswordChoice === 'security_questions' ? "Account Recovery (Security Questions)" : "Account Recovery"))
              : (currentAuthMethod === "pattern" ? "Draw Pattern" : `Enter your ${currentAuthMethod}`)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {emailSentMessage && <Alert variant="success" className="mb-3">{emailSentMessage}</Alert>}

          {forgotPasswordMode ? (
            // Step 1: Choose recovery method
            forgotPasswordChoice === null ? (
              <div className="d-grid gap-2">
                <Button onClick={() => setForgotPasswordChoice('email')} disabled={!user?.email}>
                  Reset via Email ({user?.email || 'N/A'})
                </Button>
                <Button onClick={() => {
                    if (!config || !config.securityQuestions || config.securityQuestions.length === 0) {
                        setError("No security questions are set for this account.");
                        return;
                    }
                    setSecurityQuestionsData(config.securityQuestions);
                    setForgotPasswordChoice('security_questions');
                }}>
                  Answer Security Questions
                </Button>
                <Button variant="outline-secondary" onClick={() => {
                  setForgotPasswordMode(false);
                  setForgotPasswordChoice(null);
                  setEmailSentMessage('');
                  setError('');
                  setShowTokenEntryForm(false); // Reset
                  setEmailTokenInput(''); // Reset
                  setNewMethodValueInput(''); // Reset
                  setMethodToResetInRecovery(null); // Reset
                }}>
                  Back to Login
                </Button>
              </div>
            ) :
            // Step 2: Email Reset or Security Questions Form
            forgotPasswordChoice === 'email' ? (
                // Sub-step 2a: Confirmation after sending email + Token Entry Form
                showTokenEntryForm ? (
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Enter the code from your email</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter reset code"
                                value={emailTokenInput}
                                onChange={(e) => setEmailTokenInput(e.target.value)}
                            />
                        </Form.Group>
                        {/* Use methodToResetInRecovery for input labels and types */}
                        <Form.Group className="mb-3">
                            <Form.Label>Enter your new {methodToResetInRecovery}</Form.Label>
                            {methodToResetInRecovery === "pattern" ? (
                                <div
                                    className="d-flex justify-content-center"
                                    style={{
                                        background: "#f0f0f0",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        margin: "0 auto",
                                    }}
                                >
                                    <PatternLock
                                        width={240}
                                        size={3}
                                        path={pattern}
                                        onChange={(p) => {
                                            setPattern(p);
                                            setNewMethodValueInput(p.join("")); // Keep newMethodValueInput updated for pattern
                                            setError("");
                                        }}
                                        onFinish={() => {}}
                                        visible
                                        activeColor="black"
                                        dotColor="black"
                                        lineColor="black"
                                    />
                                </div>
                            ) : (
                                <Form.Control
                                    type={methodToResetInRecovery === "password" ? "password" : "text"}
                                    inputMode={methodToResetInRecovery === "pin" ? "numeric" : undefined}
                                    pattern={methodToResetInRecovery === "pin" ? "[0-9]*" : undefined}
                                    placeholder={`Enter new ${methodToResetInRecovery}`}
                                    value={newMethodValueInput}
                                    onChange={(e) => {
                                        setNewMethodValueInput(
                                            methodToResetInRecovery === "pin"
                                                ? e.target.value.replace(/\D/g, "")
                                                : e.target.value
                                        );
                                        setError("");
                                    }}
                                />
                            )}
                        </Form.Group>
                        <div className="d-flex justify-content-between mt-3 flex-wrap">
                            <Button onClick={handleResetMethodWithToken} className="mb-2 mb-md-0">
                                Reset {methodToResetInRecovery}
                            </Button>
                            <Button variant="outline-secondary" onClick={() => {
                                setEmailTokenInput('');
                                setNewMethodValueInput('');
                                setShowTokenEntryForm(false);
                                setEmailSentMessage('');
                                setForgotPasswordChoice(null);
                                setError('');
                                setPattern([]); // Clear pattern for reset flow
                                setMethodToResetInRecovery(null); // Reset
                            }}>
                                Back to Options
                            </Button>
                        </div>
                    </Form>
                ) : (
                    // Initial state after choosing email option, before sending/showing token form
                    <>
                        <p className="text-center">A reset code will be sent to your registered email: <strong>{user?.email || 'N/A'}</strong></p>
                        <div className="d-flex justify-content-between mt-3 flex-wrap">
                            <Button onClick={handleRequestEmailReset} disabled={!user?.email}>
                                Send Reset Email
                            </Button>
                            <Button variant="outline-secondary" onClick={() => {
                                setForgotPasswordChoice(null);
                                setEmailSentMessage('');
                                setError('');
                            }}>
                                Back to Options
                            </Button>
                        </div>
                    </>
                )
            ) : ( // forgotPasswordChoice === 'security_questions'
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Select your security question</Form.Label>
                  <Dropdown className="w-100">
                    <Dropdown.Toggle variant="outline-primary" id="dropdown-basic" className="w-100 text-start">
                      {selectedQuestion || "Choose a question you set"}
                    </Dropdown.Toggle>

                    <Dropdown.Menu className="w-100">
                      {securityQuestionsData.map((q, index) => (
                        <Dropdown.Item
                          key={index}
                          onClick={() => {
                            setSelectedQuestion(q.question);
                            setAnswerToQuestion("");
                            setError("");
                          }}
                        >
                          {q.question}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Form.Group>

                {selectedQuestion && (
                  <Form.Group className="mb-3">
                    <Form.Label>{selectedQuestion}</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Your answer"
                      value={answerToQuestion}
                      onChange={(e) => {
                        setAnswerToQuestion(e.target.value);
                        setError("");
                      }}
                    />
                  </Form.Group>
                )}

                <div className="d-flex justify-content-between mt-3 flex-wrap">
                  <Button onClick={handleVerifySecurityAnswer} className="mb-2 mb-md-0">
                    Verify Answer
                  </Button>
                  <Button variant="outline-secondary" onClick={() => {
                    setForgotPasswordChoice(null);
                    setAnswerToQuestion("");
                    setSelectedQuestion("");
                    setError('');
                  }}>
                    Back to Options
                  </Button>
                </div>
              </Form>
            )
          ) : (
            // Default authentication view (enter password/pin/pattern)
            <Form>
              {currentAuthMethod === "pattern" ? (
                <>
                  <div
                    className="d-flex justify-content-center"
                    style={{
                      background: "#f0f0f0",
                      padding: "10px",
                      borderRadius: "8px",
                      margin: "0 auto",
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

                  <div className="d-flex justify-content-between mt-3 flex-wrap">
                    <Button onClick={handleVerify} className="mb-2 mb-md-0">
                      Unlock
                    </Button>
                    <Button variant="outline-secondary" onClick={() => setPattern([])}>
                      Clear Pattern
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Form.Control
                    type={currentAuthMethod === "password" ? "password" : "text"}
                    inputMode={currentAuthMethod === "pin" ? "numeric" : undefined}
                    pattern={currentAuthMethod === "pin" ? "[0-9]*" : undefined}
                    placeholder={`Enter your ${currentAuthMethod}`}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(
                        currentAuthMethod === "pin"
                          ? e.target.value.replace(/\D/g, "")
                          : e.target.value
                      );
                      setError("");
                    }}
                    className="mb-3"
                  />

                  <div className="d-flex justify-content-between mt-3 flex-wrap">
                    <Button onClick={handleVerify} className="mb-2 mb-md-0">
                      Unlock
                    </Button>
                    {/* Only show Forgot button if config is loaded and has security questions or user email for reset */}
                    {(config?.securityQuestions?.length > 0 || user?.email) && (
                      <Button
                        variant="link"
                        onClick={handleForgotPasswordClick}
                      >
                        Forgot {currentAuthMethod}?
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Form>
          )}
        </Modal.Body>
      </Modal>

      {!showModal && children}
    </>
  );
};

export default SecurityGate;
