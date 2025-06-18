// aesUtils.js
import CryptoJS from "crypto-js";

const SECRET_KEY = "bindu123$superSecretKey"; // should match encryption key used when saving

export const encryptData = (data) => {
  const stringified = JSON.stringify(data);
  return CryptoJS.AES.encrypt(stringified, SECRET_KEY).toString();
};

export const decryptData = (ciphertext) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (err) {
    console.error("❌ Decryption error:", err);
    return {};
  }
};
