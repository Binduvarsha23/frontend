// SecurityGate.jsx
import React, { useEffect, useState } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";

const API = "https://backend-pbmi.onrender.com/api/security-config";

const SecurityGate = ({ children }) => {
  const [user, loadingUser] = useAuthState(auth);
  const [isVerified, setIsVerified] = useState(false);
  const [config, setConfig] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [authMethod, setAuthMethod] = useState(null);
  const [error, setError] = useState("");

  const [step, setStep] = useState("enter");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [token, setToken] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (user) fetchConfig();
  }, [user]);

useEffect(() => {
  const onVisible = async () => {
    if (document.visibilityState === "visible" && user) {
      try {
        const res = await axios.get(`${API}/${user.uid}`);
        const latestCfg = res.data.config;
        setConfig(latestCfg);

        const methods = ["pin", "password", "pattern"];
        const lastEnabled = methods.findLast(method => latestCfg[`${method}Enabled`]);

        if (lastEnabled) {
          setAuthMethod(lastEnabled);
          setIsVerified(false);
          setShowModal(true);
        } else {
          setIsVerified(true);
          setShowModal(false);
        }
      } catch (err) {
        console.error("Error refetching config on tab switch", err);
        setIsVerified(true); // fallback
      }
    }
  };

  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [user]);


const fetchConfig = async () => {
  try {
    const res = await axios.get(`${API}/${user.uid}`);
    if (res.data.setupRequired) {
      setIsVerified(true);
      return;
    }

    const cfg = res.data.config;
    setConfig(cfg);

    const methods = ["pin", "password", "pattern"];
    const lastEnabled = methods.findLast(method => cfg[`${method}Enabled`]);

    if (lastEnabled) {
      setAuthMethod(lastEnabled);
      setShowModal(true);
    } else {
      setIsVerified(true);
      setShowModal(false);
    }
  } catch (err) {
    console.error(err);
    setError("Failed to fetch security config.");
  }
};


  const verify = async () => {
    try {
      const res = await axios.post(`${API}/verify`, {
        userId: user.uid,
        value: inputValue,
        method: authMethod,
      });
      if (res.data.success) {
        setIsVerified(true);
        setShowModal(false);
        setInputValue("");
        setError("");
      } else {
        setError("Invalid " + authMethod);
      }
    } catch (err) {
      setError("Verification failed.");
    }
  };

  const sendResetEmail = async () => {
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
      setError(err.response?.data?.message || "Error sending reset code.");
    }
  };

  const resetWithToken = async () => {
    try {
      const res = await axios.post(`${API}/reset-method-with-token`, {
        userId: user.uid,
        token,
        methodType: authMethod,
        newValue,
      });
      if (res.data.success) {
        setIsVerified(true);
        setShowModal(false);
        setStep("enter");
      } else {
        setError("Reset failed.");
      }
    } catch (err) {
      setError("Error resetting method.");
    }
  };

  const verifyAnswer = async () => {
    try {
      const res = await axios.post(`${API}/verify-security-answer`, {
        userId: user.uid,
        question: selectedQuestion,
        answer,
      });
      if (res.data.success) {
        setIsVerified(true);
        setShowModal(false);
        setStep("enter");
        setAnswer("");
        setSelectedQuestion("");
      } else {
        setError("Incorrect answer.");
      }
    } catch (err) {
      setError("Verification error.");
    }
  };

  if (loadingUser || !user || (!isVerified && !showModal)) {
    return <div className="d-flex justify-content-center p-5"><Spinner /></div>;
  }

  return (
    <>
      <Modal show={showModal} centered backdrop="static">
        <Modal.Header>
          <Modal.Title>
            {{
              enter: `Enter your ${authMethod}`,
              forgot: "Forgot " + authMethod,
              "verify-code": "Enter Reset Code",
              "set-new": `Set New ${authMethod}`,
            }[step]}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {step === "enter" && (
            <>
              <Form.Control
                type={(authMethod === "password" || authMethod === "pin" || authMethod === "pattern") ? "password" : "text"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Enter ${authMethod}`}
              />
              <div className="mt-3 d-flex justify-content-between">
                <Button onClick={verify}>Verify</Button>
                <Button variant="link" onClick={() => setStep("forgot")}>Forgot?</Button>
              </div>
            </>
          )}

          {step === "forgot" && (
            <>
              <Button className="w-100 mb-2" onClick={sendResetEmail}>
                Send Reset Code to Email
              </Button>

              {config?.securityQuestions?.length > 0 && (
                <>
                  <Form.Select
                    className="mb-2"
                    value={selectedQuestion}
                    onChange={(e) => setSelectedQuestion(e.target.value)}
                  >
                    <option>Choose Security Question</option>
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
                  />
                  <Button className="w-100 mb-2" onClick={verifyAnswer}>
                    Submit Answer
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setStep("enter")}>
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
              />
              <Form.Control
                className="mb-2"
                placeholder={`New ${authMethod}`}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
              <Button className="w-100 mb-2" onClick={resetWithToken}>
                Reset
              </Button>
              <Button variant="secondary" onClick={() => setStep("enter")}>I remember my {authMethod}</Button>
            </>
          )}

          {step === "set-new" && (
            <>
              <Form.Control
                className="mb-2"
                placeholder={`New ${authMethod}`}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
              <Button className="w-100" onClick={resetWithToken}>Set</Button>
              <Button variant="secondary" onClick={() => setStep("enter")}>I remember my {authMethod}</Button>
            </>
          )}
        </Modal.Body>
      </Modal>

      {isVerified && children}
    </>
  );
};

export default SecurityGate;
