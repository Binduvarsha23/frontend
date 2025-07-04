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
const [recentUploads, setRecentUploads] = useState({
  forms: [],
  nominees: [],
  assets: [],
  investments: [],
  passwords: []
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

  useEffect(() => {
  if (!userId) return;

  const fetchRecentUploads = async () => {
    try {
      const [forms, nominees, assets, investments, passwords] = await Promise.all([
        axios.get(`https://backend-pbmi.onrender.com/api/saved-forms?userId=${userId}`),
        axios.get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`),
        axios.get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`),
        axios.get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`),
        axios.get(`https://backend-pbmi.onrender.com/api/passwords?userId=${userId}`)
      ]);

      const sortRecent = (data) =>
        [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

      setRecentUploads({
        forms: sortRecent(forms.data),
        nominees: sortRecent(nominees.data),
        assets: sortRecent(assets.data),
        investments: sortRecent(investments.data),
        passwords: sortRecent(passwords.data),
      });
    } catch (err) {
      console.error("❌ Failed to fetch recent uploads:", err);
    }
  };

  fetchRecentUploads();
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
    <h4 className="mb-4">
      <FaHeart className="text-danger me-2" />
      Your Favorites
    </h4>

    {/* 🔐 Passwords */}
    {favorites.passwords.length > 0 && (
      <>
        <h5 className="mb-3 text-primary">🔐 Passwords</h5>
        <div className="row mb-4">
          {favorites.passwords.map((p) => {
            const decrypted = decryptData(p.data);
            return (
              <div key={p._id} className="col-md-4 mb-3">
                <div className="card p-3 shadow-sm">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="text-danger"> {decrypted.website || 'Password'}</h6>
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
        </div>
      </>
    )}

    {/* 📄 Documents */}
    {favorites.forms.length > 0 && (
  <>
    <h5 className="mb-3 text-success">📄 Documents</h5>
    <div className="row mb-4">
      {favorites.forms.map((f) => {
        const decrypted = f.data?.encrypted ? decryptData(f.data.encrypted) : f.data || {};
        return (
          <div key={f._id} className="col-md-4 mb-3">
            <div className="card p-3 shadow-sm">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="text-danger">{f.blockName}</h6>
                <FaHeart
                  className="text-danger"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleFavorite("forms", f._id)}
                />
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
                      style={{
                        width: "100%",
                        maxHeight: "150px",
                        objectFit: "contain",
                        borderRadius: "6px",
                      }}
                    />
                  ) : typeof value === "string" && value.startsWith("data:") ? (
                    <a href={value} download style={{ color: "#007bff" }}>
                      Download File
                    </a>
                  ) : (
                    <span>{String(value)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </>
)}

    {/* 💰 Wealth */}
    {(favorites.assets.length > 0 || favorites.investments.length > 0) && (
      <>
        <h5 className="mb-3 text-warning">💰 Wealth</h5>
        <div className="row mb-4">
          {favorites.assets.map((a) => (
            <div key={a._id} className="col-md-4 mb-3">
              <div className="card p-3 shadow-sm">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="text-danger"> {a.name}</h6>
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
                  <h6 className="text-danger"> {i.name}</h6>
                  <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("investments", i._id)} />
                </div>
                <div className="text-muted">Type: {i.type}</div>
                <div>Invested: ₹{i.investedAmount}</div>
                <div>Current: ₹{i.currentValue}</div>
              </div>
            </div>
          ))}
        </div>
      </>
    )}

    {/* 👥 Nominees */}
    {favorites.nominees.length > 0 && (
      <>
        <h5 className="mb-3 text-secondary">👥 Nominees</h5>
        <div className="row mb-4">
          {favorites.nominees.map((n) => (
            <div key={n._id} className="col-md-4 mb-3">
              <div className="card p-3 shadow-sm">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="text-danger"> {n.nomineeName}</h6>
                  <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("nominees", n._id)} />
                </div>
                <div><strong>Asset:</strong> {n.assetName || "Unnamed"}</div>
                <div><strong>Type:</strong> {n.type}</div>
                <div><strong>Percentage:</strong> {n.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
)}

<div className="mt-5 px-4">
  <h4 className="mb-3 text-primary">🕘 Recent Uploads</h4>

  {Object.entries(recentUploads).map(([key, list]) => list.length > 0 && (
    <div key={key} className="mb-4">
      <h5 className="text-secondary text-capitalize">
        {key === "forms" ? "Documents" : key}
      </h5>
      <div className="row">
        {list.map((item) => {
          let decrypted = item?.data?.encrypted ? decryptData(item.data.encrypted) : item.data || {};
          if (key === "passwords") decrypted = decryptData(item.data);

          return (
            <div key={item._id} className="col-12 col-sm-6 col-md-3 mb-3">
              <div className="card p-3 shadow-sm h-100">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h6 className="mb-0">
                    {key === "forms"
                      ? item.blockName
                      : item.name || item.nomineeName || decrypted.website || "Entry"}
                  </h6>
                  {item.createdAt && !isNaN(new Date(item.createdAt)) && (
  <small className="text-muted">{new Date(item.createdAt).toLocaleDateString()}</small>
)}

                </div>

                <div style={{ fontSize: "0.85rem" }}>
                  {key === "forms" && Object.entries(decrypted).slice(0, 3).map(([k, v], i) => (
                    <div key={i}><strong>{k}:</strong> {String(v).slice(0, 30)}{String(v).length > 30 && "..."}</div>
                  ))}
                  {key === "nominees" && (
                    <>
                      <div><strong>Asset:</strong> {item.assetName}</div>
                      <div><strong>Type:</strong> {item.type}</div>
                      <div><strong>%:</strong> {item.percentage}%</div>
                    </>
                  )}
                  {key === "assets" && (
                    <>
                      <div><strong>Type:</strong> {item.type}</div>
                      <div><strong>Value:</strong> ₹{item.value}</div>
                      {item.location && <div><strong>Location:</strong> {item.location}</div>}
                    </>
                  )}
                  {key === "investments" && (
                    <>
                      <div><strong>Type:</strong> {item.type}</div>
                      <div><strong>Invested:</strong> ₹{item.investedAmount}</div>
                      <div><strong>Current:</strong> ₹{item.currentValue}</div>
                    </>
                  )}
                  {key === "passwords" && (
                    <>
                      <div><strong>Website:</strong> {decrypted.website}</div>
                      <div><strong>Username:</strong> {decrypted.username}</div>
                      <div><strong>Password:</strong> {decrypted.password}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ))}
</div>


      <div className="p-4">
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
