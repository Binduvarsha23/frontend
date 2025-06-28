// 📁 components/AuthMethods/PasswordSetup.jsx
import React, { useState } from "react";
import { updateSecurityConfig, getSecurityConfig } from "../../api/securityApi";
import { auth } from "../../firebase";
import bcrypt from "bcryptjs";
import { setOnlyThisMethod } from "../../utils/setOnlyThisMethod"; 

const PasswordSetup = ({ mode = "setup", onSuccess }) => {
  const userId = auth.currentUser?.uid;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (!password) return alert("Password required");

      if (mode === "setup") {
        if (password !== confirm) return alert("Passwords do not match");
        const hash = await bcrypt.hash(password, 10);
        await setOnlyThisMethod("passwordEnabled", { passwordHash: hash });
        alert("✅ Password Set");
      } else {
        const config = await getSecurityConfig(userId);
        const valid = await bcrypt.compare(password, config.passwordHash || "");
        if (valid) onSuccess();
        else alert("❌ Invalid password");
      }
      setPassword("");
      setConfirm("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter Password"
      /><br />
      {mode === "setup" && (
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm Password"
        />
      )}
      <button disabled={loading} onClick={handleSubmit}>
        {loading ? "Saving..." : mode === "setup" ? "Set Password" : "Unlock"}
      </button>
    </div>
  );
};

export default PasswordSetup;