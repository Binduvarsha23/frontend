// SecuritySettings.jsx
import React, { useEffect, useState } from "react";
import { Button, Card, Form, Row, Col, Spinner, Alert, Dropdown } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { format } from 'date-fns';

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

const SecuritySettings = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
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

  const [mode, setMode] = useState(null);
  const [value, setValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [activeMethod, setActiveMethod] = useState(null);

  useEffect(() => {
    if (user) fetchConfig();
  }, [user]);

  const fetchConfig = async () => {
    try {
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
      } else {
        setCanChangeSecurityQuestions(true);
        setNextChangeDate(null);
      }

      setLoading(false);
    } catch (err) {
      setError("Failed to fetch security settings.");
      setLoading(false);
    }
  };

  const handleToggle = async (method) => {
    const isEnabled = config[`${method}Enabled`];

    if (isEnabled) {
      try {
        const updated = { userId: user.uid };
        updated[`${method}Enabled`] = false;
        const res = await axios.put(`${API}/${user.uid}`, updated);
        setConfig(res.data);
        setSuccessMessage(`${method} has been disabled.`);
      } catch (err) {
        setError(`Failed to disable ${method}.`);
      }
      return;
    }

    setMode(method);
    setActiveMethod(method);
    setValue("");
    setConfirmValue("");
  };

  const handleSubmit = async () => {
    const method = activeMethod;
    const trimmedValue = value.trim();
    const trimmedConfirm = confirmValue.trim();

    if (!trimmedValue || !trimmedConfirm) {
      setError("Both fields are required.");
      return;
    }

    if (trimmedValue !== trimmedConfirm) {
      setError("Values do not match.");
      return;
    }

    if (method === "pin" && !/^\d{6}$/.test(trimmedValue)) {
      setError("PIN must be exactly 6 digits.");
      return;
    }

    if (method === "password" && !/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/.test(trimmedValue)) {
      setError("Password must be at least 6 characters, include a capital letter, a digit, and a special character.");
      return;
    }

    try {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(trimmedValue, 10);
      const updated = { userId: user.uid };
      updated[`${method}Hash`] = hash;
      updated[`${method}Enabled`] = true;

      const otherMethods = ["pin", "password", "pattern"].filter(m => m !== method);
      otherMethods.forEach(m => updated[`${m}Enabled`] = false);

      const res = await axios.put(`${API}/${user.uid}`, updated);
      setConfig(res.data);
      setMode(null);
      setValue("");
      setConfirmValue("");
      setSuccessMessage(`${method} has been set successfully.`);
    } catch (err) {
      setError("Failed to set authentication method.");
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
    const hasEmptyFields = securityQuestions.some(q => !q.question || !q.answer);
    if (hasEmptyFields) {
      setError("Please complete all questions and answers.");
      return;
    }

    const unique = new Set(securityQuestions.map(q => q.question));
    if (unique.size !== 3) {
      setError("Please choose 3 different questions.");
      return;
    }

    try {
      await axios.put(`${API}/security-questions/${user.uid}`, {
        questions: securityQuestions
      });
      setSuccessMessage("Security questions updated.");
      setShowSecurityQuestionsForm(false);
      fetchConfig();
    } catch (err) {
      setError("Failed to save security questions.");
    }
  };

  if (loading) return <Spinner animation="border" className="mx-auto d-block mt-5" />;

  return (
    <Card className="p-4 shadow-sm my-4 mx-auto" style={{ maxWidth: "500px" }}>
      <h3 className="mb-3 text-center">Security Settings</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="mb-3 g-2">
        <Col xs={12} md={4}>
          <Form.Check
            type="switch"
            label="Enable PIN"
            id="pin-switch"
            checked={config.pinEnabled}
            onChange={() => handleToggle("pin")}
          />
          {mode === "pin" && (
            <>
              <Form.Control
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit PIN"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-2"
              />
              <Form.Control
                type="text"
                inputMode="numeric"
                placeholder="Confirm 6-digit PIN"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                className="mt-2"
              />
              <Button onClick={handleSubmit} className="mt-2">Save PIN</Button>
            </>
          )}
        </Col>
        <Col xs={12} md={4}>
          <Form.Check
            type="switch"
            label="Enable Password"
            id="password-switch"
            checked={config.passwordEnabled}
            onChange={() => handleToggle("password")}
          />
          {mode === "password" && (
            <>
              <Form.Control
                type="password"
                placeholder="Enter Password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-2"
              />
              <Form.Control
                type="password"
                placeholder="Confirm Password"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                className="mt-2"
              />
              <Button onClick={handleSubmit} className="mt-2">Save Password</Button>
            </>
          )}
        </Col>
        <Col xs={12} md={4}>
          <Form.Check
            type="switch"
            label="Enable Pattern"
            id="pattern-switch"
            checked={config.patternEnabled}
            onChange={() => handleToggle("pattern")}
          />
        </Col>
      </Row>

      <hr className="my-4" />
      <h4 className="text-center">Security Questions</h4>

      {config.securityQuestionsLastUpdatedAt && !canChangeSecurityQuestions && (
        <Alert variant="info" className="text-center">
          You can update your security questions again on {nextChangeDate ? format(nextChangeDate, 'PPP') : 'N/A'}.
        </Alert>
      )}

      <div className="d-grid gap-2">
        <Button
          variant="primary"
          disabled={!canChangeSecurityQuestions}
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
                  <Dropdown.Toggle className="w-100" variant="outline-secondary">
                    {q.question || "Choose a question"}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {FIXED_SECURITY_QUESTIONS.map((fixedQ, i) => (
                      <Dropdown.Item
                        key={i}
                        disabled={securityQuestions.some((sq, j) => j !== idx && sq.question === fixedQ)}
                        onClick={() => handleSecurityQuestionChange(idx, "question", fixedQ)}
                      >
                        {fixedQ}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Group>
              <Form.Group>
                <Form.Control
                  type="text"
                  placeholder="Enter your answer"
                  value={q.answer}
                  onChange={(e) => handleSecurityQuestionChange(idx, "answer", e.target.value)}
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
