// 📁 components/AuthMethods/FingerprintSetup.jsx
import React, { useState } from "react";
import { updateSecurityConfig, getSecurityConfig } from "../../api/securityApi";
import { auth } from "../../firebase";
import { setOnlyThisMethod } from "../../utils/setOnlyThisMethod";

const FingerprintSetup = ({ mode = "setup", onSuccess }) => {
  const userId = auth.currentUser?.uid;
  const [loading, setLoading] = useState(false);

  const handleSimulateScan = async () => {
    setLoading(true);
    try {
      if (mode === "setup") {
        await setOnlyThisMethod("fingerprintEnabled");
        alert("✅ Fingerprint Enabled (simulated)");
      } else {
        const config = await getSecurityConfig(userId);
        if (config.fingerprintEnabled) onSuccess();
        else alert("❌ Fingerprint not enabled");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      <p>{mode === "setup" ? "Simulate fingerprint enrollment" : "Touch fingerprint sensor (simulated)"}</p>
      <button disabled={loading} onClick={handleSimulateScan}>
        {loading ? "Processing..." : mode === "setup" ? "Enable Fingerprint" : "Verify Fingerprint"}
      </button>
    </div>
  );
};

export default FingerprintSetup;