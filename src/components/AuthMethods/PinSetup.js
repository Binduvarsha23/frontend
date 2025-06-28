// 📁 components/AuthMethods/PinSetup.jsx
import React, { useState } from "react";
import { updateSecurityConfig, getSecurityConfig } from "../../api/securityApi";
import { auth } from "../../firebase";
import bcrypt from "bcryptjs";
import { setOnlyThisMethod } from "../../utils/setOnlyThisMethod";

const PinSetup = ({ mode = "setup", onSuccess }) => {
  const userId = auth.currentUser?.uid;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (!pin) return alert("PIN required");

      if (mode === "setup") {
        if (pin !== confirm) return alert("PINs do not match");
        const hash = await bcrypt.hash(pin, 10);
        await setOnlyThisMethod("passwordEnabled", { passwordHash: hash });
        alert("✅ PIN Set");
      } else {
        const config = await getSecurityConfig(userId);
        const match = await bcrypt.compare(pin, config.pinHash || "");
        if (match) onSuccess();
        else alert("❌ Incorrect PIN");
      }
      setPin("");
      setConfirm("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Enter PIN"
      /><br />
      {mode === "setup" && (
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm PIN"
        />
      )}
      <button disabled={loading} onClick={handleSubmit}>
        {loading ? "Saving..." : mode === "setup" ? "Set PIN" : "Unlock"}
      </button>
    </div>
  );
};

export default PinSetup;
