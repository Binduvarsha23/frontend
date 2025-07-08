import React, { useEffect, useState } from "react";
import { Button, Card, Form, Row, Col, Spinner, Alert } from "react-bootstrap";
import axios from "axios";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";

const API = "https://backend-pbmi.onrender.com/api/security-config";

const toBase64URL = (buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64URL = (base64url) => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const SecuritySettings = () => {
  const [user] = useAuthState(auth);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (user) fetchConfig();
  }, [user]);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API}/${user.uid}`);
      setConfig(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        await axios.post(API, { userId: user.uid });
        fetchConfig();
      } else {
        setError("Failed to load security config.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMethod = async (method) => {
    if (!user || !config) return;
    const enabling = !config[`${method}Enabled`];
    const update = { userId: user.uid };

    if (method === "biometric" && enabling) {
      if (!window.PublicKeyCredential) {
        setError("Biometric authentication is not supported on this device.");
        return;
      }
      try {
        const { data: options } = await axios.get(`${API}/generate-registration-options/${user.uid}`);

        options.challenge = fromBase64URL(options.challenge);
        options.user.id = fromBase64URL(options.user.id);
        options.excludeCredentials.forEach(cred => {
          cred.id = fromBase64URL(cred.id);
        });

        const attestationResponse = await navigator.credentials.create({
          publicKey: options,
        });

        await axios.post(`${API}/verify-registration/${user.uid}`, {
          attestationResponse: {
            id: attestationResponse.id,
            rawId: toBase64URL(attestationResponse.rawId),
            response: {
              attestationObject: toBase64URL(attestationResponse.response.attestationObject),
              clientDataJSON: toBase64URL(attestationResponse.response.clientDataJSON),
            },
            type: attestationResponse.type,
          },
        });

        update.biometricEnabled = true;
        await axios.put(`${API}/${user.uid}`, update);
        fetchConfig();
        setSuccessMessage("Fingerprint biometric registered successfully!");
      } catch (err) {
        console.error("Biometric registration failed:", err);
        setError("Fingerprint registration failed. Try again or use another method.");
        update.biometricEnabled = false;
        await axios.put(`${API}/${user.uid}`, update);
        fetchConfig();
      }
    } else {
      update[`${method}Enabled`] = enabling;
      await axios.put(`${API}/${user.uid}`, update);
      fetchConfig();
    }
  };

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;

  return (
    <Card className="p-4 shadow-sm my-4 mx-auto" style={{ maxWidth: "500px" }}>
      <h3 className="mb-3 text-center">Security Settings</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="mb-3 g-2">
        <Col xs={12} md={6}>
          <Form.Check
            type="switch"
            id="biometric-switch"
            label="Enable Biometric"
            checked={config?.biometricEnabled}
            onChange={() => toggleMethod("biometric")}
            className="mb-2"
          />
        </Col>
      </Row>
    </Card>
  );
};

export default SecuritySettings;
