// Updated: GoogleDriveSync.js to show all fixed blocks with 0 count if needed, handle uncategorized display, and persist login state
// Also supports modal fullscreen preview on block click
import React, { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

const CLIENT_ID = "316308423435-gsmg6e2mllsd355hs7011o07509qq4fc.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive";

const blockKeywords = {
  Aadhaar: [/aadhaar/, /uidai/, /\b\d{4}\s\d{4}\s\d{4}\b/],
  "Pan card": [/pan/, /[A-Z]{5}[0-9]{4}[A-Z]/],
  Passport: [/passport/],
  "Password Minder": [/password/],
  "Voter ID": [/voter/],
  "Driving License": [/license/, /dl/],
  "Employment Details": [/employment/, /salary/, /payslip/],
  "Health Insurance": [/health/, /insurance/],
  "Term Insurance": [/term/, /insurance/],
  "Rental Agreements": [/rental/, /agreement/],
  Vehicles: [/vehicle/, /rc/],
  Will: [/will/],
  "ITR Forms": [/itr/, /tax/, /cleartax/, /savetax/],
  Utilities: [/electricity/, /bill/, /water/, /gas/],
  Subscriptions: [/subscription/],
  "Life Insurance": [/life insurance/],
  EPFO_UAN: [/epf/, /uan/],
  NPS: [/nps/],
  PPF_EPF: [/ppf/, /epf/],
  "Family properties distribution": [/property/, /distribution/],
  "Ration Card": [/ration/],
};

const GoogleDriveSync = ({ onSyncComplete }) => {
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem("accessToken") || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem("categorizedFiles");
    if (cached) {
      const parsed = JSON.parse(cached);
      ensureAllBlocksPresent(parsed);
    }

    const loadScripts = async () => {
      const gapiScript = document.createElement("script");
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.async = true;
      gapiScript.onload = () => window.gapi.load("client", initializeGapiClient);
      document.body.appendChild(gapiScript);

      const gisScript = document.createElement("script");
      gisScript.src = "https://accounts.google.com/gsi/client";
      gisScript.async = true;
      gisScript.defer = true;
      gisScript.onload = initTokenClient;
      document.body.appendChild(gisScript);
    };

    const initializeGapiClient = async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
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
            sessionStorage.setItem("accessToken", tokenResponse.access_token);
            setAccessToken(tokenResponse.access_token);
            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
          } else {
            alert("Authorization failed");
          }
        },
      });
      setTokenClient(client);
    };

    loadScripts();
  }, []);

  const ensureAllBlocksPresent = (data) => {
    const allBlocks = { ...data };
    for (const key in blockKeywords) {
      if (!allBlocks[key]) {
        allBlocks[key] = [];
      }
    }
    if (!allBlocks["Uncategorized"]) {
      allBlocks["Uncategorized"] = [];
    }
    sessionStorage.setItem("categorizedFiles", JSON.stringify(allBlocks));
    onSyncComplete(allBlocks);
  };

  const handleAuthorize = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  };

  const extractTextFromPdf = async (fileId) => {
    try {
      const res = await window.gapi.client.drive.files.get({
        fileId,
        alt: "media",
      });

      const blob = new Blob([res.body]);
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";

      for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(" ") + " ";
      }
      return text.toLowerCase();
    } catch (e) {
      console.warn("PDF parse error:", e);
      return "";
    }
  };

  const categorizeFile = async (file) => {
    let text = file.name.toLowerCase();
    if (file.mimeType === "application/pdf") {
      text += " " + (await extractTextFromPdf(file.id));
    }

    for (const [category, patterns] of Object.entries(blockKeywords)) {
      if (patterns.some((regex) => regex.test(text))) {
        return category;
      }
    }
    return "Uncategorized";
  };

  const fetchFiles = async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const res = await window.gapi.client.drive.files.list({
        pageSize: 100,
        fields: "files(id, name, mimeType, webViewLink, thumbnailLink)",
        q: "mimeType contains 'pdf' or mimeType contains 'document' or mimeType contains 'image/'",
      });

      const files = res.result.files || [];
      const categorized = {};

      for (const file of files) {
        const category = await categorizeFile(file);
        if (!categorized[category]) categorized[category] = [];
        categorized[category].push(file);
      }

      ensureAllBlocksPresent(categorized);
    } catch (e) {
      console.error("Drive fetch error:", e);
      alert("Failed to fetch Drive files");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      {!accessToken ? (
        <button className="btn btn-primary" onClick={handleAuthorize}>
          Sync with Google Drive
        </button>
      ) : (
        <button className="btn btn-success" onClick={fetchFiles} disabled={loading}>
          {loading ? "Fetching..." : "Fetch & Categorize Files"}
        </button>
      )}
    </div>
  );
};

export default GoogleDriveSync;