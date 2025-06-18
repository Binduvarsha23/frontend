export const optionalFields = ["masked", "qrcode", "withdrawal_status", "end_date", "mobile", "masked_number"];

export const isYesNoField = (key) => {
  const k = key.toLowerCase();
  return k.includes("yesno") || k.includes("linked") || k.includes("is_nominee");
};

export const getInputType = (key) => {
  const k = key.toLowerCase();
  if (k.includes("date") || k.includes("dob")) return "date";
  if (k.includes("email")) return "email";
  if (k.includes("mobile")) return "tel";
  if (
    k.includes("aadhaar") ||
    k.includes("pan") ||
    k.includes("uan") ||
    k.includes("pran") ||
    k.includes("voterid") ||
    k.includes("dlnumber") ||
    k.includes("passport_number") ||
    k.includes("ration_card_number") ||
    k.includes("policy_number") ||
    k.includes("employeeid") ||
    k.includes("acknowledgement_number")
  ) return "text"; // Use text for structured inputs
  if (k.includes("image") || k.includes("file") || k.includes("upload") || k.includes("pdf") || k.includes("qrcode") || k.includes("masked")) return "file";
  if (k.includes("amount") || k.includes("percentage") || k.includes("balance")) return "number";
  return "text";
};

export const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export const renderFilePreview = (fileData) => {
  if (!fileData) return null;
  if (fileData.startsWith("data:image")) {
    return (
      <img
        src={fileData}
        alt="Uploaded preview"
        style={{ maxWidth: "100%", maxHeight: "150px", objectFit: "contain" }}
      />
    );
  }
  if (fileData.startsWith("data:application/pdf")) {
    return (
      <iframe
        src={fileData}
        style={{ width: "100%", height: "150px", border: "none" }}
        title="PDF Preview"
      />
    );
  }
  return (
    <a href={fileData} target="_blank" rel="noopener noreferrer">
      View File
    </a>
  );
};

export const fieldPatterns = {
  aadhaar: "^[2-9]{1}[0-9]{11}$",
  pan: "[A-Z]{5}[0-9]{4}[A-Z]{1}",
  mobile: "^[6-9][0-9]{9}$",
  email: "^[\\w.-]+@[\\w.-]+\\.\\w{2,}$",
  passport_number: "^[A-PR-WYa-pr-wy][1-9]\\d{6}$",
  ifsc: "^[A-Z]{4}0[A-Z0-9]{6}$",
  pincode: "^\\d{6}$",
  account: "^\\d{9,18}$",
  uan: "^\\d{12}$",
  dlnumber: "^[A-Z]{2}[0-9]{2}[0-9]{11}$", // e.g., MH1220150012345
  ration_card_number: "^\\d{10,20}$",
  date: "^\\d{4}-\\d{2}-\\d{2}$",
  voterid: "^[A-Z]{3}[0-9]{7}$", // e.g., ABC1234567
  policy_number: "^[A-Z0-9]{8,20}$", // Alphanumeric, 8-20 chars
  employeeid: "^[A-Z0-9]{6,20}$", // Alphanumeric, 6-20 chars
  acknowledgement_number: "^[0-9]{15}$", // 15-digit number
  pran: "^\\d{12}$", // 12-digit number
  amount: "^\\d+(\\.\\d{1,2})?$", // Positive number with up to 2 decimals
  percentage: "^(100(\\.0{1,2})?|[0-9]{1,2}(\\.\\d{1,2})?)$", // 0-100 with up to 2 decimals
};

export const fieldPlaceholders = {
  aadhaar: "Enter 12-digit Aadhaar number (e.g., 234567890123)",
  pan: "Enter PAN (e.g., ABCDE1234F)",
  mobile: "Enter 10-digit mobile number (e.g., 9876543210)",
  email: "example@domain.com",
  passport_number: "Enter Passport Number (e.g., A1234567)",
  ifsc: "Enter IFSC (e.g., ABCD0123456)",
  pincode: "Enter 6-digit PIN code (e.g., 123456)",
  account: "Enter bank account number (9-18 digits)",
  uan: "Enter 12-digit UAN (e.g., 123456789012)",
  dlnumber: "Enter Driving License Number (e.g., MH1220150012345)",
  ration_card_number: "Enter Ration Card Number (10-20 digits)",
  date: "YYYY-MM-DD",
  voterid: "Enter Voter ID Number (e.g., ABC1234567)",
  policy_number: "Enter Policy Number(e.g., ABCD1234) (8-20 alphanumeric characters)",
  employeeid: "Enter Employee ID (6-20 alphanumeric characters)",
  acknowledgement_number: "Enter 15-digit Acknowledgement Number",
  pran: "Enter 12-digit PRAN (e.g., 123456789012)",
  amount: "Enter amount (e.g., 1000.00)",
  percentage: "Enter percentage (e.g., 50.00)",
};

export const getFieldPattern = (key) => {
  const k = key.toLowerCase();
  if (k.includes("aadhaar")) return fieldPatterns.aadhaar;
  if (k.includes("pan")) return fieldPatterns.pan;
  if (k.includes("mobile")) return fieldPatterns.mobile;
  if (k.includes("email")) return fieldPatterns.email;
  if (k.includes("passport")) return fieldPatterns.passport_number;
  if (k.includes("ifsc")) return fieldPatterns.ifsc;
  if (k.includes("pincode")) return fieldPatterns.pincode;
  if (k.includes("account")) return fieldPatterns.account;
  if (k.includes("uan")) return fieldPatterns.uan;
  if (k.includes("dlnumber")) return fieldPatterns.dlnumber;
  if (k.includes("ration_card_number")) return fieldPatterns.ration_card_number;
  if (k.includes("date") || k.includes("dob")) return fieldPatterns.date;
  if (k.includes("voterid")) return fieldPatterns.voterid;
  if (k.includes("policy_number")) return fieldPatterns.policy_number;
  if (k.includes("employeeid")) return fieldPatterns.employeeid;
  if (k.includes("acknowledgement_number")) return fieldPatterns.acknowledgement_number;
  if (k.includes("pran")) return fieldPatterns.pran;
  if (k.includes("amount") || k.includes("balance")) return fieldPatterns.amount;
  if (k.includes("percentage")) return fieldPatterns.percentage;
  return undefined;
};

export const getFieldPlaceholder = (key) => {
  const k = key.toLowerCase();
  if (k.includes("aadhaar")) return fieldPlaceholders.aadhaar;
  if (k.includes("pan")) return fieldPlaceholders.pan;
  if (k.includes("mobile")) return fieldPlaceholders.mobile;
  if (k.includes("email")) return fieldPlaceholders.email;
  if (k.includes("passport")) return fieldPlaceholders.passport_number;
  if (k.includes("ifsc")) return fieldPlaceholders.ifsc;
  if (k.includes("pincode")) return fieldPlaceholders.pincode;
  if (k.includes("account")) return fieldPlaceholders.account;
  if (k.includes("uan")) return fieldPlaceholders.uan;
  if (k.includes("dlnumber")) return fieldPlaceholders.dlnumber;
  if (k.includes("ration_card_number")) return fieldPlaceholders.ration_card_number;
  if (k.includes("date") || k.includes("dob")) return fieldPlaceholders.date;
  if (k.includes("voterid")) return fieldPlaceholders.voterid;
  if (k.includes("policy_number")) return fieldPlaceholders.policy_number;
  if (k.includes("employeeid")) return fieldPlaceholders.employeeid;
  if (k.includes("acknowledgement_number")) return fieldPlaceholders.acknowledgement_number;
  if (k.includes("pran")) return fieldPlaceholders.pran;
  if (k.includes("amount") || k.includes("balance")) return fieldPlaceholders.amount;
  if (k.includes("percentage")) return fieldPlaceholders.percentage;
  return `Enter ${key}`;
};