// Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  Card,
  Container,
  Row,
  Col,
  Button,
  Spinner,
  Modal,
  Form,
} from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { renderFilePreview } from "./utils";
import { decryptData } from "./aesUtils";
import {
  createCustomBlock,
  getUserBlocks,
  deleteCustomBlock,
} from "../api/blockApi";
import { useInView } from "react-intersection-observer";
import { get, set } from "idb-keyval";
import "./Dashboard.css";

const Dashboard = () => {
  const [blocks, setBlocks] = useState([]);
  const [customBlocks, setCustomBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockUploads, setBlockUploads] = useState({});
  const [modalImage, setModalImage] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [visibleBlocks, setVisibleBlocks] = useState(8);
  const { ref: bottomRef, inView } = useInView({ threshold: 0 });
  const [userId, setUserId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      loadCachedData();
      fetchInitialData();
    }
  }, [userId]);

  useEffect(() => {
    if (inView) setVisibleBlocks((prev) => prev + 8);
  }, [inView]);

  const loadCachedData = async () => {
    try {
      const [cachedBlocks, cachedUploads] = await Promise.all([
        get("blocks"),
        get("blockUploads"),
      ]);

      if (cachedBlocks) setBlocks(cachedBlocks);
      if (cachedUploads) setBlockUploads(cachedUploads);

      if (cachedBlocks || cachedUploads) setLoading(false);
    } catch (err) {
      console.warn("Failed to read from IndexedDB:", err);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [blockRes, customRes] = await Promise.all([
        fetch("https://backend-pbmi.onrender.com/api/blocks"),
        getUserBlocks(userId),
      ]);

      const blockData = await blockRes.json();
      const allBlocks = [...blockData, ...customRes];

      setBlocks(blockData);
      setCustomBlocks(customRes);
      await set("blocks", blockData);

      const uploadsMap = {};
      for (const block of allBlocks) {
        const res = await fetch(
          `https://backend-pbmi.onrender.com/api/saved-forms/${block._id}?userId=${userId}`
        );
        if (!res.ok) continue;
        const forms = await res.json();

        uploadsMap[block._id] = forms.map(({ _id, blockName, createdAt, data }) => {
          const decrypted = data?.encrypted ? decryptData(data.encrypted) : data;
          const entries = Object.entries(decrypted);
          const previewImage = entries.find(
            ([, val]) => typeof val === "string" && val.startsWith("data:image")
          )?.[1];
          return {
            _id,
            blockName,
            createdAt,
            previewImage,
            entries: entries.slice(0, 3),
            fullEntries: entries,
          };
        });
      }

      setBlockUploads(uploadsMap);
      await set("blockUploads", uploadsMap);
    } catch (err) {
      console.error("❌ Failed to fetch data:", err);
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleBlockClick = (block) => {
    const isCustom = block.userId !== undefined;
    const path = isCustom
      ? `/dashboard/custom/${block._id}`
      : `/dashboard/block/${block._id}`;

    navigate(path, {
      state: { blockName: block.name || block.blockName },
    });
  };


  const handleCreateBlock = async () => {
    if (!newBlockName.trim()) return toast.warn("Block name is required");
    try {
      await createCustomBlock(userId, newBlockName.trim());
      toast.success("Block created!");
      setNewBlockName("");
      setShowCreateModal(false);
      await set("blocks", null);
      await set("blockUploads", null);
      fetchInitialData();
    } catch (err) {
      toast.error("Failed to create block");
    }
  };

  const formatBlockTitle = (title) => {
  if (!title) return "";
  const words = title.split(" ");
  if (words.length >= 2) {
    return (
      <>
        {words.slice(0, -1).join(" ")}<br />
        {words[words.length - 1]}
      </>
    );
  }
  return title;
};


  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm("Are you sure you want to delete this block?")) return;
    try {
      await deleteCustomBlock(blockId);
      toast.success("Block deleted");

      const updatedBlocks = blocks.filter((b) => b._id !== blockId);
      const updatedCustomBlocks = customBlocks.filter((b) => b._id !== blockId);
      const updatedUploads = { ...blockUploads };
      delete updatedUploads[blockId];

      setBlocks(updatedBlocks);
      setCustomBlocks(updatedCustomBlocks);
      setBlockUploads(updatedUploads);

      await set("blocks", updatedBlocks);
      await set("blockUploads", updatedUploads);
    } catch (err) {
      toast.error("Failed to delete block");
    }
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{
  fontSize: "1.75rem",
  fontWeight: "600",
  fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
  color: "#343a40",
  letterSpacing: "0.5px",
  marginBottom: "0"
}}>
  Your Document Blocks
</h2>
    <div className="mt-2">
  <small className="text-muted">Manage and access your digital documents</small>
</div>
        <div>
          <Button onClick={() => setShowCreateModal(true)} className="me-2">
            + Create Custom Block
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <>
          <Row>
            {[...blocks, ...customBlocks].slice(0, visibleBlocks).map((block) => (
              <Col key={block._id} xs={6} sm={4} md={3} lg={2} className="mb-3">
                <Card
                  className="block-card text-center"
                  onClick={() => handleBlockClick(block)}
                  style={{ height: "140px", fontSize: "0.9rem", cursor: "pointer" }}
                >
                  {!block.userId && block.iconUrl && (
                    <Card.Img
                      variant="top"
                      src={block.iconUrl}
                      style={{
                        height: "60px",
                        width: "60px",
                        objectFit: "contain",
                        margin: "10px auto 0",
                      }}
                    />
                  )}
                  {block.userId && (
                    <div
                      style={{
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    />
                  )}
                  <Card.Body className="p-2">
<Card.Title
  className="mb-0"
  style={{ fontSize: "1rem", lineHeight: 1.2, wordBreak: "break-word" }}
>
  {formatBlockTitle(block.name || block.blockName)}
</Card.Title>

                    {block.userId && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="mt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(block._id);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
<h4 className="mt-5">Recent Uploads</h4>
<Row>
  {Object.entries(blockUploads).flatMap(([blockId, forms]) =>
    forms.map((form, index) => {
      // Map icons based on block name or document type
      let iconClass = "fa-file-alt"; // Default icon
      if (form.blockName.toLowerCase().includes("pan")) iconClass = "fa-id-card";
      else if (form.blockName.toLowerCase().includes("aadhaar")) iconClass = "fa-address-card";
      else if (form.blockName.toLowerCase().includes("mutual fund")) iconClass = "fa-piggy-bank";
      else if (form.blockName.toLowerCase().includes("insurance")) iconClass = "fa-umbrella";

      return (
        <Col key={`${blockId}-${index}`} xs={12} sm={6} md={4} lg={3} className="mb-4">
          <Card className="h-100 shadow-sm recent-upload-card" style={{ borderRadius: "10px", height: "200px" }}>
            <Card.Body className="d-flex flex-column justify-content-between" style={{ padding: "15px" }}>
              <div style={{ overflowY: "auto", maxHeight: "145px" }}>
                <div className="d-flex align-items-center mb-2">
                  <i
                    className={`fas ${iconClass}`}
                    style={{ fontSize: "1.5rem", color: "#007bff", paddingRight: "10px" }}
                  ></i>
                  <Card.Title className="text-truncate mb-0" style={{ fontSize: "1.1rem", maxWidth: "80%" }}>
                    {form.blockName}
                  </Card.Title>
                </div>
                <p className="text-muted mb-2" style={{ fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {new Date(form.createdAt).toLocaleString()}
                </p>
                {form.previewImage && (
                  <img
                    src={form.previewImage}
                    alt="preview"
                    style={{
                      width: "100%",
                      height: "100px",
                      objectFit: "cover",
                      borderRadius: "6px",
                      marginBottom: "10px",
                      cursor: "pointer",
                    }}
                    onClick={() => setModalImage(form.previewImage)}
                  />
                )}
                {form.entries.map(([field, value], i) => {
                  const decryptedValue = value?.encrypted ? decryptData(value.encrypted) : value;
                  const valueStr = typeof decryptedValue === "string" ? decryptedValue : String(decryptedValue);
                  return (
                    <div key={i} className="d-flex justify-content-between" style={{ fontSize: "0.85rem", marginBottom: "5px", wordBreak: "break-word" }}>
                      <strong style={{ marginRight: "10px", minWidth: "40%", whiteSpace: "nowrap" }}>{field}:</strong>
                      <span style={{ textAlign: "right", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {valueStr.length > 30 ? valueStr.slice(0, 30) + "..." : valueStr}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Button
                variant="link"
                className="p-0 mt-2 align-self-start"
                onClick={() =>
                  setModalData({
                    blockName: form.blockName,
                    entries: form.fullEntries,
                    createdAt: form.createdAt,
                  })
                }
              >
                <i className="fas fa-eye" style={{ color: "#000000", fontSize: "1.2rem" }}></i>
              </Button>
            </Card.Body>
          </Card>
        </Col>
      );
    })
  )}
</Row>     
          <div ref={bottomRef}></div>
        </>
      )}

      {/* Create Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Custom Block</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="text"
            placeholder="Enter block name"
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateBlock}>
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Full Data Modal */}
      <Modal show={!!modalData} onHide={() => setModalData(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{modalData?.blockName} - Full Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            Submitted at: {modalData && new Date(modalData.createdAt).toLocaleString()}
          </p>
          <Row>
            {modalData?.entries.map(([field, value]) => (
              <Col xs={12} sm={6} md={4} className="mb-3" key={field}>
                <strong>{field}</strong>
                <div>
                  {typeof value === "string" && value.startsWith("data:image") ? (
                    <img
                      src={value}
                      alt={field}
                      style={{ maxWidth: "100%", maxHeight: "150px" }}
                    />
                  ) : typeof value === "string" && value.startsWith("data:") ? (
                    renderFilePreview(value)
                  ) : (
                    <div>{value}</div>
                  )}
                </div>
              </Col>
            ))}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalData(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Dashboard;
