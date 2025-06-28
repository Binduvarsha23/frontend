// components/VaultUnlock.jsx
import React, { useEffect, useState } from "react";
import { getSecurityConfig } from "../api/securityApi";
import { auth } from "../firebase";
import PinSetup from "./AuthMethods/PinSetup";
import PasswordSetup from "./AuthMethods/PasswordSetup";
import PatternSetup from "./AuthMethods/PatternSetup";
import FingerprintSetup from "./AuthMethods/FingerprintSetup";

const VaultUnlock = ({ onUnlock }) => {
  const [methods, setMethods] = useState({});
  const [selected, setSelected] = useState(null);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    getSecurityConfig(userId).then((cfg) => {
      const enabled = {
        pin: cfg.pinEnabled,
        password: cfg.passwordEnabled,
        pattern: cfg.patternEnabled,
        fingerprint: cfg.fingerprintEnabled,
      };

      const anyEnabled = Object.values(enabled).some(Boolean);
      if (!anyEnabled) return onUnlock(); // open directly if none selected

      setMethods(enabled);
      setSelected(Object.keys(enabled).find((k) => enabled[k])); // default first
    });
  }, [userId]);

  return (
    <div className="container mt-5">
      <h3 className="mb-4">🔐 Unlock Vault</h3>
      <div className="mb-3 d-flex gap-2 flex-wrap">
        {methods.pin && <button onClick={() => setSelected("pin")}>PIN</button>}
        {methods.password && <button onClick={() => setSelected("password")}>Password</button>}
        {methods.pattern && <button onClick={() => setSelected("pattern")}>Pattern</button>}
        {methods.fingerprint && <button onClick={() => setSelected("fingerprint")}>Fingerprint</button>}
      </div>

      {selected === "pin" && <PinSetup mode="verify" onSuccess={onUnlock} />}
      {selected === "password" && <PasswordSetup mode="verify" onSuccess={onUnlock} />}
      {selected === "pattern" && <PatternSetup mode="verify" onSuccess={onUnlock} />}
      {selected === "fingerprint" && <FingerprintSetup onSuccess={onUnlock} />}
    </div>
  );
};

export default VaultUnlock;