import React, { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

const CLIENT_ID = "641125780732-h0dpbmtkn6l7usv5946dnpip2amfmpaa.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

const blockKeywords = {
  Aadhaar: [/aadhaar/, /uidai/, /\b\d{4}\s\d{4}\s\d{4}\b/],
  "Pan card": [
    /pan/,
    /e-pan/,
    /epan/,
    /utiitsl/,
    /\buti\b.*\bpan\b/,
    /\b[A-Z]{5}[0-9]{4}[A-Z]\b/, // e.g., ABCDE1234F
  ],
  Passport: [/passport/],
  "Password Minder": [/password/],
  "Voter ID": [/voter/],
  "Driving License": [/driving license/, /\bdl\b/, /\blicense\b/],
  "Employment Details": [/employment/, /salary/, /payslip/, /job offer/, /appointment letter/],
  "Health Insurance": [/health insurance/, /mediclaim/, /health policy/],
  "Term Insurance": [/term insurance/, /life cover/, /sum assured/],
  "Rental Agreements": [/rental agreement/, /lease/, /tenant/],
  Vehicles: [/\bvehicle\b/, /\brc\b/, /\bcar\b/, /two-wheeler/, /registration certificate/],
  Will: [/will/, /inheritance/],
  "ITR Forms": [/itr/, /income tax/, /cleartax/, /form 16/, /tax filing/, /tax return/],
  Utilities: [/electricity bill/, /water bill/, /gas bill/, /utility/, /broadband bill/],
  Subscriptions: [/subscription/, /renewal/, /payment successful/, /invoice/],
  "Life Insurance": [/life insurance/, /policy number/, /premium due/],
  EPFO_UAN: [/epf/, /uan/, /provident fund/],
  NPS: [/\bnps\b/, /national pension system/],
  PPF_EPF: [/\bppf\b/, /\bepf\b/],
  "Family properties distribution": [/property distribution/, /succession/, /legal heir/],
};

const GmailCategorizedSync = () => {
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem("gmailAccessToken") || null);
  const [tokenClient, setTokenClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categorized, setCategorized] = useState(() => {
    const initial = {};
    Object.keys(blockKeywords).forEach((key) => (initial[key] = []));
    initial["Uncategorized"] = [];
    return initial;
  });

  useEffect(() => {
    const loadScripts = () => {
      const gapiScript = document.createElement("script");
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.onload = () => window.gapi.load("client", initGapiClient);
      document.body.appendChild(gapiScript);

      const gisScript = document.createElement("script");
      gisScript.src = "https://accounts.google.com/gsi/client";
      gisScript.async = true;
      gisScript.defer = true;
      gisScript.onload = initTokenClient;
      document.body.appendChild(gisScript);
    };

    const initGapiClient = async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"],
        });
        if (accessToken) {
          window.gapi.client.setToken({ access_token: accessToken });
        }
      } catch (e) {
        console.error("GAPI init error:", e);
      }
    };

    const initTokenClient = () => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse?.access_token) {
            sessionStorage.setItem("gmailAccessToken", tokenResponse.access_token);
            setAccessToken(tokenResponse.access_token);
            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
          }
        },
      });
      setTokenClient(client);
    };

    loadScripts();
  }, []);

  const handleAuthorize = () => {
    if (tokenClient) tokenClient.requestAccessToken();
  };

  const decodeBase64 = (base64) => {
    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  };

  const extractTextFromPdf = async (base64Data) => {
    try {
      const bytes = decodeBase64(base64Data);
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      let text = "";
      for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(" ") + " ";
      }
      return text.toLowerCase();
    } catch (err) {
      return "";
    }
  };

  const categorizeFile = (name, content) => {
    const lowerName = name.toLowerCase();
    let bestCategory = null;
    let maxMatches = 0;

    for (const [category, patterns] of Object.entries(blockKeywords)) {
      let matches = 0;

      for (const regex of patterns) {
        if (regex.test(lowerName)) matches++;
        if (regex.test(content)) matches++;
      }

      if (matches > maxMatches && matches >= 2) {
        bestCategory = category;
        maxMatches = matches;
      }
    }

    return bestCategory || "Uncategorized";
  };

  const fetchAndCategorizeEmails = async () => {
    setLoading(true);
    try {
      const res = await window.gapi.client.gmail.users.messages.list({
        userId: "me",
        q: "has:attachment filename:pdf",
        maxResults: 30,
      });

      const messages = res.result.messages || [];

      for (const msg of messages) {
        const fullMsg = await window.gapi.client.gmail.users.messages.get({
          userId: "me",
          id: msg.id,
        });

        const parts = fullMsg.result.payload?.parts || [];

        const pdfParts = parts.filter(
          (p) => p.filename?.endsWith(".pdf") && p.body?.attachmentId
        );

        for (const part of pdfParts) {
          const attachment = await window.gapi.client.gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msg.id,
            id: part.body.attachmentId,
          });

          const base64 = attachment.result.data;
          const content = await extractTextFromPdf(base64);
          const category = categorizeFile(part.filename, content);

          const url = URL.createObjectURL(
            new Blob([decodeBase64(base64)], { type: "application/pdf" })
          );

          setCategorized((prev) => ({
            ...prev,
            [category]: [...prev[category], { name: part.filename, url }],
          }));
        }
      }
    } catch (e) {
      console.error("Gmail fetch failed:", e);
      alert("Failed to fetch Gmail attachments: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      {!accessToken ? (
        <button className="btn btn-primary" onClick={handleAuthorize}>
          Connect Gmail
        </button>
      ) : (
        <button className="btn btn-success" onClick={fetchAndCategorizeEmails} disabled={loading}>
          {loading ? "Scanning..." : "Fetch & Categorize"}
        </button>
      )}
      <div className="mt-4">
        {Object.entries(categorized).map(([category, files]) => (
          <div key={category} style={{ marginBottom: "24px" }}>
            <h5 style={{ borderBottom: "1px solid #ccc" }}>{category} ({files.length})</h5>
            {files.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "#999" }}>No files yet.</p>
            ) : (
              files.map((file, idx) => (
                <div key={idx} style={{ padding: 6, borderBottom: "1px dashed #ddd" }}>
                  📎 {file.name} –{" "}
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    🔍 Preview
                  </a>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GmailCategorizedSync;
