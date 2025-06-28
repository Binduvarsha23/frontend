import React, { useEffect, useState } from "react";
import {
  Form, Button, Card, Row, Col, Container, Badge,
} from "react-bootstrap";
import { getSecurityConfig, updateSecurityConfig } from "../api/securityApi";
import { auth } from "../firebase";
import { ToastContainer, toast } from "react-toastify";
import PinSetup from "./AuthMethods/PinSetup";
import PasswordSetup from "./AuthMethods/PasswordSetup";
import PatternSetup from "./AuthMethods/PatternSetup";
import FingerprintSetup from "./AuthMethods/FingerprintSetup";
import { setOnlyThisMethod } from "../utils/setOnlyThisMethod";

const SecuritySettings = () => {
  const userId = auth.currentUser?.uid;

  const [config, setConfig] = useState({
    fingerprintEnabled: false,
    pinEnabled: false,
    pin: "",
    confirmPin: "",
    autoLockMinutes: 5,
    backupEnabled: true,
    offlineAccess: false,
    encryptionStatus: "Active",
    lastBackup: null,
  });

  useEffect(() => {
    if (userId) {
      getSecurityConfig(userId).then((res) => {
        setConfig((prev) => ({ ...prev, ...res }));
      });
    }
  }, [userId]);

const handleChange = (key, value) => {
  setConfig((prev) => ({ ...prev, [key]: value }));
};

const toggleOption = async (key) => {
  await setOnlyThisMethod(key);
  const updated = await getSecurityConfig(userId);
  setConfig((prev) => ({ ...prev, ...updated }));
};

  const handleUpdatePIN = async () => {
    if (config.pin !== config.confirmPin) {
      toast.error("PINs do not match");
      return;
    }
    await updateSecurityConfig(userId, { pin: config.pin });
    toast.success("PIN updated");
    setConfig((prev) => ({ ...prev, pin: "", confirmPin: "" }));
  };

  const handleToggle = async (key) => {
    const newValue = !config[key];
    setConfig((prev) => ({ ...prev, [key]: newValue }));
    await updateSecurityConfig(userId, { [key]: newValue });
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <h4>🔒 Security Settings</h4>
      <p>Configure security and privacy options for your vault</p>

      <Row className="g-4">
        <Col md={6}>
          <Card className="p-4">
  <h5>Authentication Settings</h5>

  <Form.Check
    type="switch"
    label="PIN"
    checked={config.pinEnabled}
    onChange={() => toggleOption("pinEnabled")}
  />
  {config.pinEnabled && <PinSetup mode="setup" />}

  <Form.Check
    type="switch"
    label="Password"
    checked={config.passwordEnabled}
    onChange={() => toggleOption("passwordEnabled")}
  />
  {config.passwordEnabled && <PasswordSetup mode="setup" />}

  <Form.Check
    type="switch"
    label="Pattern"
    checked={config.patternEnabled}
    onChange={() => toggleOption("patternEnabled")}
  />
  {config.patternEnabled && <PatternSetup mode="setup" />}

  <Form.Check
    type="switch"
    label="Fingerprint"
    checked={config.fingerprintEnabled}
    onChange={() => toggleOption("fingerprintEnabled")}
  />
  {config.fingerprintEnabled && <FingerprintSetup mode="setup" />}

  <Form.Group className="mt-3">
    <Form.Label>Auto-lock Timer (minutes)</Form.Label>
    <Form.Select
      value={config.autoLockMinutes}
      onChange={(e) => handleChange("autoLockMinutes", +e.target.value)}
      onBlur={() =>
        updateSecurityConfig(userId, {
          autoLockMinutes: config.autoLockMinutes,
        })
      }
    >
      {[1, 5, 10, 15, 30].map((v) => (
        <option key={v} value={v}>
          {v} minutes
        </option>
      ))}
    </Form.Select>
  </Form.Group>
</Card>
        </Col>

        <Col md={6}>
          <Card className="p-4">
            <h5>Change PIN</h5>
            <Form.Control
              className="mb-2"
              placeholder="Enter 4–6 digit PIN"
              value={config.pin}
              onChange={(e) => handleChange("pin", e.target.value)}
              type="password"
              maxLength={6}
            />
            <Form.Control
              className="mb-2"
              placeholder="Confirm PIN"
              value={config.confirmPin}
              onChange={(e) => handleChange("confirmPin", e.target.value)}
              type="password"
              maxLength={6}
            />
            <Button onClick={handleUpdatePIN}>Update PIN</Button>
          </Card>

          <Card className="p-4 mt-4">
            <h5>Security Status</h5>
            <div className="mb-2">
              <strong>Encryption Status:</strong>{" "}
              <Badge bg="success">{config.encryptionStatus}</Badge>
            </div>
            <div className="mb-2">
              <strong>Last Backup:</strong>{" "}
              <Badge bg="light" text="dark">
                {config.lastBackup
                  ? new Date(config.lastBackup).toLocaleString()
                  : "Never"}
              </Badge>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default SecuritySettings;