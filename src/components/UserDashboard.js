import React, { useState, useEffect } from "react";
import GoogleDriveSync from "./GmailSync";
import { Button, Card, Row, Col, Spinner } from "react-bootstrap"; // Added Card, Row, Col, Spinner for better display
import "./UserDashboard.css";
import axios from "axios";
import { FaHeart, FaFileMedical, FaFileAlt } from "react-icons/fa"; // Added FaFileMedical
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
    nominees: [],
    healthRecords: [], // Added healthRecords to favorites
  });
  const [recentUploads, setRecentUploads] = useState({
    forms: [],
    nominees: [],
    assets: [],
    investments: [],
    passwords: [],
    healthRecords: [], // Added healthRecords to recent uploads
  });
  const [loadingFavorites, setLoadingFavorites] = useState(true); // New loading state for favorites
  const [loadingRecent, setLoadingRecent] = useState(true); // New loading state for recent uploads


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
      setLoadingFavorites(true); // Start loading
      try {
        const cached = await getCachedFavorites();
        if (cached) {
          setFavorites(cached);
          setLoadingFavorites(false); // Stop loading if cached data is used
          return;
        }

        const [assets, investments, passwords, forms, nominees, healthRecords] = await Promise.all([
          axios.get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/passwords?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/saved-forms?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/health-records?userId=${userId}`), // Fetch health records
        ]);

        const filtered = {
          assets: assets.data.filter(a => a.favorite),
          investments: investments.data.filter(i => i.favorite),
          passwords: passwords.data.filter(p => p.favorite),
          forms: forms.data.filter(f => f.favorite),
          nominees: nominees.data.filter(n => n.favorite),
          healthRecords: healthRecords.data.filter(hr => hr.favorite), // Filter health records
        };

        setFavorites(filtered);
        await setCachedFavorites(filtered);
      } catch (err) {
        console.error("Error fetching favorites:", err);
      } finally {
        setLoadingFavorites(false); // Stop loading
      }
    };

    fetchFavorites();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const fetchRecentUploads = async () => {
      setLoadingRecent(true); // Start loading
      try {
        const [forms, nominees, assets, investments, passwords, healthRecords] = await Promise.all([
          axios.get(`https://backend-pbmi.onrender.com/api/saved-forms?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/passwords?userId=${userId}`),
          axios.get(`https://backend-pbmi.onrender.com/api/health-records?userId=${userId}`), // Fetch health records
        ]);

        const sortRecent = (data) =>
          [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

        setRecentUploads({
          forms: sortRecent(forms.data),
          nominees: sortRecent(nominees.data),
          assets: sortRecent(assets.data),
          investments: sortRecent(investments.data),
          passwords: sortRecent(passwords.data),
          healthRecords: sortRecent(healthRecords.data), // Sort health records
        });
      } catch (err) {
        console.error("❌ Failed to fetch recent uploads:", err);
      } finally {
        setLoadingRecent(false); // Stop loading
      }
    };

    fetchRecentUploads();
  }, [userId]);


  const toggleFavorite = async (type, id) => {
    // Optimistic UI update
    setFavorites(prev => {
      const updated = {
        ...prev,
        [type]: prev[type].map(item =>
          item._id === id ? { ...item, favorite: !item.favorite } : item
        )
      };
      // Filter out unfavorited items for display
      const filteredForDisplay = {
        ...updated,
        [type]: updated[type].filter(item => item.favorite)
      };
      // Update cache with the full toggled state, not just filtered
      set(`favorites-${userId}`, { timestamp: Date.now(), data: updated });
      return filteredForDisplay; // Return filtered for immediate UI update
    });

    try {
      await axios.patch(`https://backend-pbmi.onrender.com/api/${type}/${id}/favorite`);
      // No toast here, as the UI already updated optimistically
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      // Rollback UI if API call fails
      setFavorites(prev => {
        const rolledBack = {
          ...prev,
          [type]: prev[type].map(item =>
            item._id === id ? { ...item, favorite: !item.favorite } : item
          )
        };
        // Re-filter for display after rollback
        const filteredForDisplay = {
          ...rolledBack,
          [type]: rolledBack[type].filter(item => item.favorite)
        };
        set(`favorites-${userId}`, { timestamp: Date.now(), data: rolledBack });
        return filteredForDisplay;
      });
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

  const handleViewFile = (fileData) => {
    if (!fileData || !fileData.startsWith("data:")) {
      alert("File is still loading or corrupted."); // Using alert for simplicity, consider a custom modal
      return;
    }
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(
        `<iframe src="${fileData}" frameborder="0" style="width:100%;height:100%;" allowfullscreen></iframe>`
      );
      newWindow.document.title = "Health Record Viewer";
    } else {
      alert("Popup blocked. Please allow popups for this site."); // Using alert for simplicity
    }
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
      <div className="mt-4 px-4">
        <h4 className="mb-4">
          <FaHeart className="text-danger me-2" />
          Your Favorites
        </h4>

        {loadingFavorites ? (
          <div className="text-center my-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading Favorites...</span>
            </Spinner>
            <p className="mt-2">Loading your favorite items...</p>
          </div>
        ) : (
          <>
            {/* 🔐 Passwords */}
            {favorites.passwords.length > 0 && (
              <>
                <h5 className="mb-3 text-primary">🔐 Passwords</h5>
                <Row className="mb-4">
                  {favorites.passwords.map((p) => {
                    const decrypted = decryptData(p.data);
                    return (
                      <Col md={4} key={p._id} className="mb-3">
                        <Card className="p-3 shadow-sm h-100">
                          <div className="d-flex justify-content-between align-items-center">
                            <Card.Title className="text-danger mb-0"> {decrypted.website || 'Password'}</Card.Title>
                            <FaHeart
                              className="text-danger"
                              style={{ cursor: "pointer" }}
                              onClick={() => toggleFavorite("passwords", p._id)}
                            />
                          </div>
                          <div className="text-muted">Category: {p.blockName}</div>
                          <div><strong>Username:</strong> {decrypted.username}</div>
                          <div><strong>Password:</strong> {decrypted.password}</div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </>
            )}

            {/* 📄 Documents */}
            {favorites.forms.length > 0 && (
              <>
                <h5 className="mb-3 text-success">📄 Documents</h5>
                <Row className="mb-4">
                  {favorites.forms.map((f) => {
                    const decrypted = f.data?.encrypted ? decryptData(f.data.encrypted) : f.data || {};
                    return (
                      <Col md={4} key={f._id} className="mb-3">
                        <Card className="p-3 shadow-sm h-100">
                          <div className="d-flex justify-content-between align-items-center">
                            <Card.Title className="text-danger mb-0"> {f.blockName}</Card.Title>
                            <FaHeart
                              className="text-danger"
                              style={{ cursor: "pointer" }}
                              onClick={() => toggleFavorite("forms", f._id)}
                            />
                          </div>
                          <div className="text-muted mb-2">
                            Submitted: {new Date(f.createdAt).toLocaleString()}
                          </div>
                          {Object.entries(decrypted).slice(0, 3).map(([field, value], i) => (
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
                                <span>{String(value).slice(0, 50)}{String(value).length > 50 ? '...' : ''}</span>
                              )}
                            </div>
                          ))}
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </>
            )}

            {/* 💰 Wealth */}
            {(favorites.assets.length > 0 || favorites.investments.length > 0) && (
              <>
                <h5 className="mb-3 text-warning">💰 Wealth</h5>
                <Row className="mb-4">
                  {favorites.assets.map((a) => (
                    <Col md={4} key={a._id} className="mb-3">
                      <Card className="p-3 shadow-sm h-100">
                        <div className="d-flex justify-content-between align-items-center">
                          <Card.Title className="text-danger mb-0"> {a.name}</Card.Title>
                          <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("assets", a._id)} />
                        </div>
                        <div className="text-muted">Type: {a.type}</div>
                        <div>Value: ₹{a.value}</div>
                        {a.location && <div>Location: {a.location}</div>}
                      </Card>
                    </Col>
                  ))}
                  {favorites.investments.map((i) => (
                    <Col md={4} key={i._id} className="mb-3">
                      <Card className="p-3 shadow-sm h-100">
                        <div className="d-flex justify-content-between align-items-center">
                          <Card.Title className="text-danger mb-0"> {i.name}</Card.Title>
                          <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("investments", i._id)} />
                        </div>
                        <div className="text-muted">Type: {i.type}</div>
                        <div>Invested: ₹{i.investedAmount}</div>
                        <div>Current: ₹{i.currentValue}</div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}

            {/* 👥 Nominees */}
            {favorites.nominees.length > 0 && (
              <>
                <h5 className="mb-3 text-secondary">👥 Nominees</h5>
                <Row className="mb-4">
                  {favorites.nominees.map((n) => (
                    <Col md={4} key={n._id} className="mb-3">
                      <Card className="p-3 shadow-sm h-100">
                        <div className="d-flex justify-content-between align-items-center">
                          <Card.Title className="text-danger mb-0"> {n.nomineeName}</Card.Title>
                          <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("nominees", n._id)} />
                        </div>
                        <div><strong>Asset:</strong> {n.assetName || "Unnamed"}</div>
                        <div><strong>Type:</strong> {n.type}</div>
                        <div><strong>Percentage:</strong> {n.percentage}%</div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}

            {/* 🏥 Health Records */}
            {favorites.healthRecords.length > 0 && (
              <>
                <h5 className="mb-3 text-info">🏥 Health Records</h5>
                <Row className="mb-4">
                  {favorites.healthRecords.map((hr) => (
                    <Col md={4} key={hr._id} className="mb-3">
                      <Card className="p-3 shadow-sm h-100">
                        <div className="d-flex justify-content-between align-items-center">
                          <Card.Title className="text-danger mb-0">
                            <FaFileMedical className="me-2" />{hr.fileName}
                          </Card.Title>
                          <FaHeart className="text-danger" style={{ cursor: "pointer" }} onClick={() => toggleFavorite("healthRecords", hr._id)} />
                        </div>
                        <div className="text-muted">Block: {hr.blockName}</div>
                        <div className="text-muted mb-2">
                          Uploaded: {new Date(hr.createdAt).toLocaleString()}
                        </div>
                        <Button variant="outline-primary" size="sm" onClick={() => handleViewFile(hr.fileData)}>
                          View File
                        </Button>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}

            {Object.values(favorites).every(arr => arr.length === 0) && (
              <p className="text-muted text-center">No favorite items yet. Mark items as favorite to see them here.</p>
            )}
          </>
        )}
      </div>

      <div className="mt-5 px-4">
        <h4 className="mb-3 text-primary">🕘 Recent Uploads</h4>

        {loadingRecent ? (
          <div className="text-center my-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading Recent Uploads...</span>
            </Spinner>
            <p className="mt-2">Loading your recent uploads...</p>
          </div>
        ) : (
          <>
            {Object.entries(recentUploads).map(([key, list]) => list.length > 0 && (
              <div key={key} className="mb-4">
                <h5 className="text-secondary text-capitalize">
                  {key === "forms" ? "Documents" : key === "healthRecords" ? "Health Records" : key}
                </h5>
                <Row>
                  {list.map((item) => {
                    let displayContent;
                    let title = "Entry";
                    let typeIcon = null; // To hold the icon if needed

                    switch (key) {
                      case "forms":
                        const decryptedForm = item?.data?.encrypted ? decryptData(item.data.encrypted) : item.data || {};
                        title = item.blockName;
                        typeIcon = <FaFileAlt className="me-2 text-primary" />;
                        displayContent = (
                          <>
                            {Object.entries(decryptedForm).slice(0, 3).map(([k, v], i) => (
                              <div key={i}>
                                <strong>{k}:</strong>{" "}
                                {typeof v === "string" && v.startsWith("data:image") ? (
                                  <img src={v} alt={k} style={{ width: "100%", maxHeight: "80px", objectFit: "contain", borderRadius: "3px" }} />
                                ) : typeof v === "string" && v.startsWith("data:") ? (
                                  <a href={v} download style={{ color: "#007bff" }}>Download File</a>
                                ) : (
                                  <span>{String(v).slice(0, 30)}{String(v).length > 30 && "..."}</span>
                                )}
                              </div>
                            ))}
                          </>
                        );
                        break;
                      case "nominees":
                        title = item.nomineeName;
                        displayContent = (
                          <>
                            <div><strong>Asset:</strong> {item.assetName || "Unnamed"}</div>
                            <div><strong>Type:</strong> {item.type}</div>
                            <div><strong>%:</strong> {item.percentage}%</div>
                          </>
                        );
                        break;
                      case "assets":
                        title = item.name;
                        displayContent = (
                          <>
                            <div><strong>Type:</strong> {item.type}</div>
                            <div><strong>Value:</strong> ₹{item.value}</div>
                            {item.location && <div><strong>Location:</strong> {item.location}</div>}
                          </>
                        );
                        break;
                      case "investments":
                        title = item.name;
                        displayContent = (
                          <>
                            <div><strong>Type:</strong> {item.type}</div>
                            <div><strong>Invested:</strong> ₹{item.investedAmount}</div>
                            <div><strong>Current:</strong> ₹{item.currentValue}</div>
                          </>
                        );
                        break;
                      case "passwords":
                        const decryptedPassword = decryptData(item.data);
                        title = decryptedPassword.website;
                        displayContent = (
                          <>
                            <div><strong>Website:</strong> {decryptedPassword.website}</div>
                            <div><strong>Username:</strong> {decryptedPassword.username}</div>
                            <div><strong>Password:</strong> {decryptedPassword.password}</div>
                          </>
                        );
                        break;
                      case "healthRecords":
                        title = item.fileName;
                        typeIcon = <FaFileMedical className="me-2 text-info" />;
                        displayContent = (
                          <>
                            <div><strong>Block:</strong> {item.blockName}</div>
                            <Button variant="outline-primary" size="sm" className="mt-2" onClick={() => handleViewFile(item.fileData)}>
                              View File
                            </Button>
                          </>
                        );
                        break;
                      default:
                        displayContent = null;
                    }

                    return (
                      <Col xs={12} sm={6} md={3} key={item._id} className="mb-3">
                        <Card className="p-3 shadow-sm h-100">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <Card.Title className="mb-0" style={{ fontSize: "1rem" }}>
                              {typeIcon}{title}
                            </Card.Title>
                            {item.createdAt && !isNaN(new Date(item.createdAt)) && (
                              <small className="text-muted">{new Date(item.createdAt).toLocaleDateString()}</small>
                            )}
                          </div>
                          <div style={{ fontSize: "0.85rem" }}>
                            {displayContent}
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            ))}
            {Object.values(recentUploads).every(arr => arr.length === 0) && (
              <p className="text-muted text-center">No recent uploads found.</p>
            )}
          </>
        )}
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
