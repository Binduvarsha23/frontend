import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
  Card,
  Container,
  Row,
  Col,
  Button,
  Spinner,
  Carousel,
  Modal,
} from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FormComponent from "./FormComponent.jsx";

export default function Dashboard() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlockFields, setSelectedBlockFields] = useState(null);
  const [loadingFields, setLoadingFields] = useState(false);
  const [selectedBlockName, setSelectedBlockName] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [formData, setFormData] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [savedForms, setSavedForms] = useState([]);
  const [loadingSavedForms, setLoadingSavedForms] = useState(false);
  const [recentUploads, setRecentUploads] = useState([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenContent, setFullScreenContent] = useState(null);

  const navigate = useNavigate();

  const optionalFields = ["masked", "qrcode", "withdrawalstatus", "enddateif"];
  const user = auth.currentUser;
  const userId = user?.uid;

  const CACHE_KEY_BLOCKS = "cached_blocks";
  const CACHE_KEY_RECENT_UPLOADS = "cached_recent_uploads";
  const CACHE_KEY_FIELDS_PREFIX = "cached_fields_"; // Per block caching for fields

  const isYesNoField = (key) => {
    const k = key.toLowerCase();
    return k.startsWith("yes") || k.endsWith("yes_no") || k.includes("yesno");
  };

  const getInputType = (key) => {
    const k = key.toLowerCase();
    if (k.includes("dob") || k.includes("date")) return "date";
    if (k.includes("phone") || k.includes("mobile") || k.includes("number"))
      return "number";
    if (
      k.includes("image") ||
      k.includes("upload") ||
      k.includes("file") ||
      k.includes("pdf")
    )
      return "file";
    return "text";
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  useEffect(() => {
    const cachedBlocks = localStorage.getItem(CACHE_KEY_BLOCKS);
    if (cachedBlocks) {
      setBlocks(JSON.parse(cachedBlocks));
      fetchRecentUploads(JSON.parse(cachedBlocks));
      setLoading(false);
    }

    fetch("https://backend-pbmi.onrender.com/api/blocks")
      .then((res) => res.json())
      .then((data) => {
        setBlocks(data);
        localStorage.setItem(CACHE_KEY_BLOCKS, JSON.stringify(data));
        toast.success("Blocks loaded successfully!", { autoClose: 2000 });
        fetchRecentUploads(data);
      })
      .catch((err) => {
        console.error("Error fetching blocks:", err);
        toast.error("Failed to load blocks. Please try again.", {
          autoClose: 3000,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchRecentUploads = async (blocksData) => {
    const cachedUploads = localStorage.getItem(CACHE_KEY_RECENT_UPLOADS);
    if (cachedUploads) {
      setRecentUploads(JSON.parse(cachedUploads));
    }

    try {
      let allForms = [];

      for (const block of blocksData) {
        const res = await fetch(
          `https://backend-pbmi.onrender.com/api/saved-forms/${block._id}?userId=${userId}`
        );
        if (!res.ok) {
          console.warn(`Failed to fetch saved forms for block ${block.name}`);
          continue;
        }
        const forms = await res.json();
        const formsWithBlock = forms.map((f) => ({
          ...f,
          blockName: block.name,
        }));
        allForms = allForms.concat(formsWithBlock);
      }

      allForms.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

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
      localStorage.setItem(CACHE_KEY_RECENT_UPLOADS, JSON.stringify(uploads));
      setShowAllRecent(false);
      setCarouselIndex(0);
    } catch (error) {
      console.error("Error fetching recent uploads:", error);
      toast.error("Failed to load recent uploads.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handleBlockClick = async (block) => {
    const loadingToastId = toast.info("Loading form fields...", {
      autoClose: false,
      closeButton: false,
    });

    const cacheKey = `${CACHE_KEY_FIELDS_PREFIX}${block._id}`;
    const cachedFields = localStorage.getItem(cacheKey);
    if (cachedFields) {
      setSelectedBlockFields(JSON.parse(cachedFields));
      setSelectedBlockName(block.name);
      setSelectedBlockId(block._id);

      const init = {};
      Object.keys(JSON.parse(cachedFields)).forEach((key) => (init[key] = ""));
      setFormData(init);
      setFormSubmitted(false);

      fetchSavedForms(block._id);

      toast.dismiss(loadingToastId);
      toast.success("Form fields loaded from cache!");
      return;
    }

    try {
      const res = await fetch(
        `https://backend-pbmi.onrender.com/api/block-fields/${block._id}`
      );
      if (!res.ok) throw new Error("Failed to fetch block fields");
      const fields = await res.json();

      setSelectedBlockFields(fields);
      setSelectedBlockName(block.name);
      setSelectedBlockId(block._id);

      localStorage.setItem(cacheKey, JSON.stringify(fields));

      const init = {};
      Object.keys(fields).forEach((key) => (init[key] = ""));
      setFormData(init);
      setFormSubmitted(false);

      fetchSavedForms(block._id);

      toast.dismiss(loadingToastId);
      toast.success("Form fields loaded!");
    } catch (err) {
      console.error(err);
      toast.dismiss(loadingToastId);
      toast.error("Failed to load fields for this block");
    }
  };

  const fetchSavedForms = async (blockId) => {
    setLoadingSavedForms(true);
    try {
      const res = await fetch(
        `https://backend-pbmi.onrender.com/api/saved-forms/${blockId}?userId=${userId}`
      );
      if (!res.ok) throw new Error("Failed to fetch saved forms");
      const data = await res.json();
      setSavedForms(data);
    } catch (error) {
      console.error(error);
      toast.error("Error loading saved form data");
      setSavedForms([]);
    } finally {
      setLoadingSavedForms(false);
    }
  };

  const handleToggleRecent = () => {
    setShowAllRecent((prev) => !prev);
    setCarouselIndex(0);
  };

  const handleSelectCarousel = (selectedIndex) => {
    setCarouselIndex(selectedIndex);
  };

  const handleBackToBlocks = () => {
    setSelectedBlockFields(null);
    setSelectedBlockName("");
    setSelectedBlockId(null);
    setFormData({});
    setFormSubmitted(false);
    setSavedForms([]);
  };

  const renderFilePreview = (fileData) => {
    if (!fileData) return null;

    if (fileData.startsWith("data:image")) {
      return (
        <img
          src={fileData}
          alt="Uploaded preview"
          style={{ maxWidth: "100%", maxHeight: "150px", objectFit: "contain", cursor: "pointer" }}
          onClick={() => {
            setFullScreenContent(fileData);
            setShowFullScreen(true);
          }}
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

  const handleDownload = (fileData, fileName) => {
    const link = document.createElement("a");
    link.href = fileData;
    link.download = fileName || "downloaded_file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <Modal
        show={showFullScreen}
        onHide={() => setShowFullScreen(false)}
        centered
        fullscreen
      >
        <Modal.Body style={{ display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.9)" }}>
          {fullScreenContent && (
            <img
              src={fullScreenContent}
              alt="Full screen preview"
              style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFullScreen(false)}>
            Close
          </Button>
          {fullScreenContent && (
            <Button
              variant="primary"
              onClick={() => handleDownload(fullScreenContent, "fullscreen_image")}
            >
              Download
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📁 Your Document Blocks</h2>
        <Button variant="danger" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {!selectedBlockFields ? (
        <>
          <div className="mb-4">
            <h4>📂 Recent Uploads</h4>
            {recentUploads.length === 0 ? (
              <p>No recent uploads found.</p>
            ) : (
              <>
                {!showAllRecent ? (
                  <Row>
                    {recentUploads.slice(0, 4).map((upload) => (
                      <Col
                        key={`${upload.formId}-${upload.fieldName}`}
                        xs={12}
                        sm={6}
                        md={3}
                        className="mb-3"
                      >
                        <Card className="h-100 shadow-sm">
                          <Card.Body>
                            <Card.Title style={{ fontSize: "1rem" }}>
                              {upload.blockName}
                            </Card.Title>
                            <Card.Text
                              style={{ fontSize: "0.85rem", wordBreak: "break-word" }}
                            >
                              {upload.fieldName}
                            </Card.Text>
                            <div>{renderFilePreview(upload.fileData)}</div>
                            <Button
                              variant="link"
                              onClick={() =>
                                handleDownload(upload.fileData, `${upload.fieldName}_${upload.formId}`)
                              }
                              className="p-0 mt-2"
                            >
                              Download
                            </Button>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Carousel
                    activeIndex={carouselIndex}
                    onSelect={handleSelectCarousel}
                    interval={null}
                    indicators={false}
                    prevLabel="Previous"
                    nextLabel="Next"
                  >
                    {recentUploads.map((upload) => (
                      <Carousel.Item key={`${upload.formId}-${upload.fieldName}`}>
                        <Card className="mx-auto" style={{ maxWidth: "400px" }}>
                          <Card.Body>
                            <Card.Title>{upload.blockName}</Card.Title>
                            <Card.Text style={{ wordBreak: "break-word" }}>
                              {upload.fieldName}
                            </Card.Text>
                            <div>{renderFilePreview(upload.fileData)}</div>
                            <div
                              className="text-muted mt-2"
                              style={{ fontSize: "0.8rem" }}
                            >
                              Uploaded: {new Date(upload.submittedAt).toLocaleString()}
                            </div>
                            <Button
                              variant="link"
                              onClick={() =>
                                handleDownload(upload.fileData, `${upload.fieldName}_${upload.formId}`)
                              }
                              className="p-0 mt-2"
                            >
                              Download
                            </Button>
                          </Card.Body>
                        </Card>
                      </Carousel.Item>
                    ))}
                  </Carousel>
                )}
                <Button variant="link" onClick={handleToggleRecent} className="p-0 mt-2">
                  {showAllRecent ? `View All` : `ShowLess`}
                </Button>
              </>
            )}
          </div>

          {loadingFields ? (
            <div className="text-center my-4">
              <Spinner animation="border" role="status" />
              <div>Loading form fields...</div>
            </div>
          ) : loading ? (
            <Spinner animation="border" />
          ) : (
            <Row>
              {blocks.map((block) => (
                <Col
                  key={block._id}
                  xs={12}
                  md={4}
                  className="mb-3"
                  style={{ cursor: "pointer" }}
                >
                  <Card
                    className="h-100 shadow-sm"
                    onClick={() => handleBlockClick(block)}
                    style={{ cursor: "pointer" }}
                  >
                    <Card.Body className="d-flex align-items-center">
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
                      <Card.Title className="mb-0">{block.name}</Card.Title>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      ) : (
        <FormComponent
          selectedBlockFields={selectedBlockFields}
          selectedBlockName={selectedBlockName}
          selectedBlockId={selectedBlockId}
          formData={formData}
          setFormData={setFormData}
          formSubmitted={formSubmitted}
          setFormSubmitted={setFormSubmitted}
          savedForms={savedForms}
          setSavedForms={setSavedForms}
          loadingSavedForms={loadingSavedForms}
          setLoadingSavedForms={setLoadingSavedForms}
          blocks={blocks}
          userId={userId}
          fetchRecentUploads={fetchRecentUploads}
          handleBackToBlocks={handleBackToBlocks}
          optionalFields={optionalFields}
          isYesNoField={isYesNoField}
          getInputType={getInputType}
          convertFileToBase64={convertFileToBase64}
          renderFilePreview={renderFilePreview}
          fetchSavedForms={fetchSavedForms}
          setFullScreenContent={setFullScreenContent}
          setShowFullScreen={setShowFullScreen}
        />
      )}
    </Container>
  );
}
