// ---------- Dashboard.js ----------

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Card, Container, Row, Col, Button, Spinner, Carousel, Modal } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { renderFilePreview } from "./utils";

const Dashboard = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentUploads, setRecentUploads] = useState([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [modalImage, setModalImage] = useState(null);
  const navigate = useNavigate();
  const user = auth.currentUser;
  const userId = user?.uid;

  useEffect(() => {
    const cachedBlocks = sessionStorage.getItem("blocks");
    if (cachedBlocks) {
      const parsed = JSON.parse(cachedBlocks);
      setBlocks(parsed);
      setLoading(false);
      fetchRecentUploads(parsed);
    } else {
      fetch("https://backend-pbmi.onrender.com/api/blocks")
        .then((res) => res.json())
        .then((data) => {
          setBlocks(data);
          sessionStorage.setItem("blocks", JSON.stringify(data));
          toast.success("Blocks loaded successfully!", { autoClose: 2000 });
          fetchRecentUploads(data);
        })
        .catch((err) => {
          console.error("Error fetching blocks:", err);
          toast.error("Failed to load blocks. Please try again.");
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const fetchRecentUploads = async (blocksData) => {
    const cacheKey = `recentUploads_${userId}`;
    const cachedUploads = sessionStorage.getItem(cacheKey);
    if (cachedUploads) {
      setRecentUploads(JSON.parse(cachedUploads));
      return;
    }

    try {
      let allForms = [];
      for (const block of blocksData) {
        const res = await fetch(
          `https://backend-pbmi.onrender.com/api/saved-forms/${block._id}?userId=${userId}`
        );
        if (!res.ok) continue;
        const forms = await res.json();
        const formsWithBlock = forms.map((f) => ({ ...f, blockName: block.name }));
        allForms = allForms.concat(formsWithBlock);
      }
      allForms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      let uploads = [];
      for (const form of allForms) {
        for (const [key, value] of Object.entries(form.data)) {
          if (typeof value === "string" && value.startsWith("data:")) {
            uploads.push({
              formId: form._id,
              blockName: form.blockName,
              fieldName: key,
              fileData: value,
              submittedAt: form.createdAt,
            });
          }
        }
      }
      uploads = uploads.slice(0, 10);
      setRecentUploads(uploads);
      setShowAllRecent(false);
      setCarouselIndex(0);
    } catch (error) {
      console.error("Error fetching recent uploads:", error);
      toast.error("Failed to load recent uploads.");
    }
  };

  const handleBlockClick = (block) =>
  navigate(`/dashboard/block/${block._id}`, {
    state: { blockName: block.name },
  });

  const handleToggleRecent = () => {
    setShowAllRecent((prev) => !prev);
    setCarouselIndex(0);
  };
  const handleSelectCarousel = (selectedIndex) => setCarouselIndex(selectedIndex);
  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📁 Your Document Blocks</h2>
        <Button variant="danger" onClick={handleLogout}>Logout</Button>
      </div>

      <div className="mb-4">
        <h4>📂 Recent Uploads</h4>
        {recentUploads.length === 0 ? (
          <p>No recent uploads found.</p>
        ) : (
          <>
            {!showAllRecent ? (
              <Row>
                {recentUploads.slice(0, 4).map((upload) => (
                  <Col key={`${upload.formId}-${upload.fieldName}`} xs={12} sm={6} md={3} className="mb-3">
                    <Card className="h-100 shadow-sm">
                      <Card.Body>
                        <Card.Title style={{ fontSize: "1rem" }}>{upload.blockName}</Card.Title>
                        <Card.Text style={{ fontSize: "0.85rem", wordBreak: "break-word" }}>{upload.fieldName}</Card.Text>
                        <div>
                          {upload.fileData.startsWith("data:image") ? (
                            <img
                              src={upload.fileData}
                              alt="preview"
                              style={{ maxWidth: "100%", maxHeight: "100px", cursor: "pointer" }}
                              onClick={() => setModalImage(upload.fileData)}
                            />
                          ) : (
                            renderFilePreview(upload.fileData)
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Carousel activeIndex={carouselIndex} onSelect={handleSelectCarousel} interval={null} indicators={false}>
                {recentUploads.map((upload) => (
                  <Carousel.Item key={`${upload.formId}-${upload.fieldName}`}>
                    <Card className="mx-auto" style={{ maxWidth: "400px" }}>
                      <Card.Body>
                        <Card.Title>{upload.blockName}</Card.Title>
                        <Card.Text style={{ wordBreak: "break-word" }}>{upload.fieldName}</Card.Text>
                        <div>
                          {upload.fileData.startsWith("data:image") ? (
                            <img
                              src={upload.fileData}
                              alt="preview"
                              style={{ maxWidth: "100%", maxHeight: "150px", cursor: "pointer" }}
                              onClick={() => setModalImage(upload.fileData)}
                            />
                          ) : (
                            renderFilePreview(upload.fileData)
                          )}
                        </div>
                        <div className="text-muted mt-2" style={{ fontSize: "0.8rem" }}>
                          Uploaded: {new Date(upload.submittedAt).toLocaleString()}
                        </div>
                      </Card.Body>
                    </Card>
                  </Carousel.Item>
                ))}
              </Carousel>
            )}
            <Button variant="link" onClick={handleToggleRecent} className="p-0 mt-2">
              {showAllRecent ? `View All` : `Show Less`}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <Row>
          {blocks.map((block) => (
            <Col key={block._id} xs={12} md={4} className="mb-3" onClick={() => handleBlockClick(block)} style={{ cursor: "pointer" }}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex align-items-center">
                  <img
                    src={block.iconUrl}
                    alt={block.name}
                    style={{ width: "40px", height: "40px", objectFit: "contain", marginRight: "15px" }}
                  />
                  <Card.Title className="mb-0">{block.name}</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal show={!!modalImage} onHide={() => setModalImage(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Image Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {modalImage && (
            <img
              src={modalImage}
              alt="Full preview"
              style={{ width: "100%", maxHeight: "80vh", objectFit: "contain" }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalImage(null)}>Close</Button>
          <Button variant="primary" onClick={() => {
            const a = document.createElement("a");
            a.href = modalImage;
            a.download = "image.png";
            a.click();
          }}>Download</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Dashboard;
