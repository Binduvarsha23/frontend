import React, { useState, useEffect } from "react";
import GoogleDriveSync from "./GmailSync";
import { Button } from "react-bootstrap";
import "./UserDashboard.css";
import axios from "axios";
import { FaHeart } from "react-icons/fa";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { get, set } from "idb-keyval";
import { decryptData } from "./aesUtils";

const FAVORITES_TTL = 2 * 60 * 1000; // 2 minutes

const UserDashboard = () => {
  const [syncedFiles, setSyncedFiles] = useState(null);
  const [activeBlock, setActiveBlock] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [userId, setUserId] = useState(null);
  const [favorites, setFavorites] = useState({
    assets: [],
    investments: [],
    passwords: [],
    forms: [],
    nominees: []
  });

  // Set userId from Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // Load favorites from cache or API
  useEffect(() => {
    if (!userId) return;

    const getCachedFavorites = async () => {
      const cached = await get(`favorites-${userId}`);
      if (!cached) return null;
      return Date.now() - cached.timestamp < FAVORITES_TTL ? cached.data : null;
    };

    const setCachedFavorites = async (data) => {
      await set(`favorites-${userId}`, {
        timestamp: Date.now(),
        data
      });
    };

    const fetchFavorites = async () => {
      try {
        const cached = await getCachedFavorites();
        if (cached) {
          setFavorites(cached);
          return;
        }

        const [assets, investments, passwords, forms, nominees] = await Promise.all([
          axios.get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/passwords?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/saved-forms?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`)
        ]);

        const filtered = {
          assets: assets.data.filter(a => a.favorite),
          investments: investments.data.filter(i => i.favorite),
          passwords: passwords.data.filter(p => p.favorite),
          forms: forms.data.filter(f => f.favorite),
          nominees: nominees.data.filter(n => n.favorite)
        };

        setFavorites(filtered);
        await setCachedFavorites(filtered);
      } catch (err) {
        console.error("Error fetching favorites:", err);
      }
    };

    fetchFavorites();
  }, [userId]);

 const toggleFavorite = async (type, id) => {
  setFavorites(prev => {
    const updated = {
      ...prev,
      [type]: prev[type].filter(item => item._id !== id)
    };
    // Update cache too
    set(`favorites-${userId}`, { timestamp: Date.now(), data: updated });
    return updated;
  });

  try {
    await axios.patch(`https://backend-pbmi.onrender.com/api/${type}/${id}/favorite`);
  } catch (err) {
    console.error("Failed to toggle favorite:", err);
  }
};

  const handleSyncComplete = (data) => {
    setSyncedFiles(data);
    setLastSynced(new Date().toLocaleString());
  };

  const handleBlockClick = (block) => {
    setActiveBlock(block);
  };

  const handleClose = () => {
    setActiveBlock(null);
  };

  const renderPreview = (file) => (
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
              <div className="hover-translate-up col-md-4 mb-3" key={file.id}>
                <div className="border p-2 rounded bg-white">
                  <div className="mb-2" style={{ height: "150px", overflow: "hidden" }}>
                    {renderPreview(file)}
                  </div>
                  <div style={{ wordBreak: "break-word" }}>
                    <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
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
    <>
      {/* ❤️ Favorites Section */}
      {Object.values(favorites).some(arr => arr.length > 0) && (
        <div className="mt-4 px-4">
          <h4 className="mb-3">
            <FaHeart className="text-danger me-2" />
            Your Favorites
          </h4>
          <div className="row">
            {favorites.assets.map((a) => (
              <div key={a._id} className="col-md-4 mb-3">
                <div className="card p-3 shadow-sm">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="text-danger"><FaHeart /> {a.name}</h6>
                    <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("assets", a._id)} />
                  </div>
                  <div className="text-muted">Type: {a.type}</div>
                  <div>Value: ₹{a.value}</div>
                  {a.location && <div>Location: {a.location}</div>}
                </div>
              </div>
            ))}
            {favorites.investments.map((i) => (
              <div key={i._id} className="col-md-4 mb-3">
                <div className="card p-3 shadow-sm">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="text-danger"><FaHeart /> {i.name}</h6>
                    <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("investments", i._id)} />
                  </div>
                  <div className="text-muted">Type: {i.type}</div>
                  <div>Invested: ₹{i.investedAmount}</div>
                  <div>Current: ₹{i.currentValue}</div>
                </div>
              </div>
            ))}
            {favorites.passwords.map((p) => {
  const decrypted = decryptData(p.data);
  return (
    <div key={p._id} className="col-md-4 mb-3">
      <div className="card p-3 shadow-sm">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="text-danger"><FaHeart /> {decrypted.website || 'Password'}</h6>
          <FaHeart
            className="text-danger"
            style={{ cursor: "pointer" }}
            onClick={() => toggleFavorite("passwords", p._id)}
          />
        </div>
        <div className="text-muted">Category: {p.blockName}</div>
        <div><strong>Username:</strong> {decrypted.username}</div>
        <div><strong>Password:</strong> {decrypted.password}</div>
      </div>
    </div>
  );
})}

            {favorites.forms.map((f) => {
              const decrypted = f.data?.encrypted ? decryptData(f.data.encrypted) : f.data || {};
              return (
                <div key={f._id} className="col-md-4 mb-3">
                  <div className="card p-3 shadow-sm">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="text-danger"><FaHeart /> {f.blockName}</h6>
                      <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("saved-forms", f._id)} />
                    </div>
                    <div className="text-muted mb-2">
                      Submitted: {new Date(f.createdAt).toLocaleString()}
                    </div>
                    {Object.entries(decrypted).map(([field, value], i) => (
                      <div key={i} style={{ fontSize: "0.85rem", marginBottom: "5px" }}>
                        <strong>{field}:</strong>{" "}
                        {typeof value === "string" && value.startsWith("data:image") ? (
                          <img
                            src={value}
                            alt={field}
                            style={{ width: "100%", maxHeight: "150px", objectFit: "contain", borderRadius: "6px" }}
                          />
                        ) : typeof value === "string" && value.startsWith("data:") ? (
                          <a href={value} download style={{ color: "#007bff" }}>Download File</a>
                        ) : (
                          <span>{String(value)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {favorites.nominees.map((n) => (
              <div key={n._id} className="col-md-4 mb-3">
                <div className="card p-3 shadow-sm">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="text-danger"><FaHeart /> {n.nomineeName}</h6>
                    <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("nominees", n._id)} />
                  </div>
                  <div><strong>Asset:</strong> {n.assetName || "Unnamed"}</div>
                  <div><strong>Type:</strong> {n.type}</div>
                  <div><strong>Percentage:</strong> {n.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </>
  );
};

export default UserDashboard;
