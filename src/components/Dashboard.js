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

  const handleLogout = async () => {
    await signOut(auth);
    await set("blocks", null);
    await set("blockUploads", null);
    navigate("/");
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
        <h2>📁 Your Document Blocks</h2>
        <div>
          <Button onClick={() => setShowCreateModal(true)} className="me-2">
            + Create Custom Block
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <>
          <Row>
            {[...blocks, ...customBlocks].slice(0, visibleBlocks).map((block) => (
              <Col key={block._id} xs={12} md={4} className="mb-3">
                <Card
                  className="h-100 shadow-sm"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleBlockClick(block)}
                >
                  <Card.Body className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      {block.iconUrl && !block.userId && (
                        <img
                          src={block.iconUrl}
                          alt={block.name}
                          style={{
                            width: "40px",
                            height: "40px",
                            objectFit: "contain",
                            marginRight: "15px",
                          }}
                        />
                      )}
                      <Card.Title className="mb-0">
                        {block.name || block.blockName}
                      </Card.Title>
                    </div>
                    {block.userId && (
                      <Button
                        variant="outline-danger"
                        size="sm"
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
          {Object.entries(blockUploads).flatMap(([blockId, forms]) =>
            forms.map((form, index) => (
              <Card key={`${blockId}-${index}`} className="mb-3 shadow-sm">
                <Card.Body>
                  <Card.Title>{form.blockName}</Card.Title>
                  <p className="text-muted">
                    Submitted at: {new Date(form.createdAt).toLocaleString()}
                  </p>
                  {form.previewImage && (
                    <img
                      src={form.previewImage}
                      alt="preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "140px",
                        borderRadius: 6,
                        marginBottom: 8,
                        cursor: "pointer",
                      }}
                      onClick={() => setModalImage(form.previewImage)}
                    />
                  )}
                  {form.entries.map(([field, value]) => (
                    <div key={field} style={{ fontSize: "0.9rem" }}>
                      <strong>{field}:</strong>{" "}
                      {typeof value === "string" && value.length > 30
                        ? value.slice(0, 30) + "..."
                        : value}
                    </div>
                  ))}
                  <Button
                    variant="link"
                    className="p-0 mt-2"
                    onClick={() =>
                      setModalData({
                        blockName: form.blockName,
                        entries: form.fullEntries,
                        createdAt: form.createdAt,
                      })
                    }
                  >
                    View More
                  </Button>
                </Card.Body>
              </Card>
            ))
          )}
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
