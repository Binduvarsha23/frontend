// 📁 components/AuthMethods/PatternSetup.jsx
import React, { useState } from "react";
import { updateSecurityConfig, getSecurityConfig } from "../../api/securityApi";
import { auth } from "../../firebase";
import { setOnlyThisMethod } from "../../utils/setOnlyThisMethod";
import bcrypt from "bcryptjs";

const PatternSetup = ({ mode = "setup", onSuccess }) => {
  const userId = auth.currentUser?.uid;
  const [pattern, setPattern] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (!pattern || pattern.length < 4) return alert("Pattern too short");

      if (mode === "setup") {
        if (pattern !== confirm) return alert("Patterns do not match");
        const hash = await bcrypt.hash(pattern, 10);
        await setOnlyThisMethod("passwordEnabled", { passwordHash: hash });
        alert("✅ Pattern Set");
      } else {
        const config = await getSecurityConfig(userId);
        if (btoa(pattern) === config.patternHash) onSuccess();
        else alert("❌ Wrong pattern");
      }

      setPattern("");
      setConfirm("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      <input
        type="text"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        placeholder="Enter pattern (e.g. 1235789)"
      /><br />
      {mode === "setup" && (
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm pattern"
        />
      )}
      <button disabled={loading} onClick={handleSubmit}>
        {loading ? "Saving..." : mode === "setup" ? "Set Pattern" : "Unlock"}
      </button>
    </div>
  );
};

export default PatternSetup;