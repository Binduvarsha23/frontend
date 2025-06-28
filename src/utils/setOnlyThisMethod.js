// src/utils/setOnlyThisMethod.js
import { updateSecurityConfig } from "../api/securityApi";
import { auth } from "../firebase";

export const setOnlyThisMethod = async (enabledKey, payload = {}) => {
  const userId = auth.currentUser?.uid;
  const reset = {
    pinEnabled: false,
    passwordEnabled: false,
    patternEnabled: false,
    fingerprintEnabled: false
  };
  reset[enabledKey] = true;
  await updateSecurityConfig(userId, { ...reset, ...payload });
};