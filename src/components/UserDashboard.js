import React, { useState } from "react";
import GoogleDriveSync from "./GoogleDriveSync";
import { Button } from "react-bootstrap";
import "./UserDashboard.css";

const UserDashboard = () => {
  const [syncedFiles, setSyncedFiles] = useState(null);
  const [activeBlock, setActiveBlock] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  const handleSyncComplete = (data) => {
    console.log("Categorized Files:", data);
    setSyncedFiles(data);
    const now = new Date().toLocaleString();
    setLastSynced(now);
  };

  const handleBlockClick = (block) => {
    setActiveBlock(block);
  };

  const handleClose = () => {
    setActiveBlock(null);
  };

  const renderPreview = (file) => {
    return (
      <div
        style={{
          backgroundColor: "#4b5563",
          color: "#fff",
          height: "150px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "10px",
          borderRadius: "0.5rem",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "10px", wordBreak: "break-word" }}>{file.name}</div>
      </div>
    );
  };

  if (activeBlock) {
    return (
      <div className="p-4" style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3>{activeBlock.name}</h3>
          <Button variant="secondary" onClick={handleClose}>Back to Dashboard</Button>
        </div>
        {activeBlock.files.length > 0 ? (
          <div className="row">
            {activeBlock.files.map((file) => (
              <div className="hover-translate-up col-md-4 mb-3" key={file.id} >
                <div className="border p-2 rounded bg-white">
                  <div className="mb-2" style={{ height: "150px", overflow: "hidden" }}>
                    {renderPreview(file)}
                  </div>
                  <div style={{ wordBreak: "break-word" }}>
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {file.name}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No files categorized under this block.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-3">Welcome to Your Dashboard</h2>
      <GoogleDriveSync onSyncComplete={handleSyncComplete} />
      {lastSynced && <div className="text-muted mb-3">Last synced: {lastSynced}</div>}

      <div className="d-flex flex-wrap gap-3">
        {syncedFiles &&
          Object.entries(syncedFiles).map(([block, files]) => (
            <div
              key={block}
              className="p-3 border rounded bg-light text-center" 
              style={{ cursor: "pointer", width: "180px" }}
              onClick={() => handleBlockClick({ name: block, files })}
            >
              <h6 className="mb-1">{block}</h6>
              <span className="badge bg-secondary">{files.length}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default UserDashboard;
