// File: src/pages/CustomBlockForm.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Form, Button, Container, Row, Col, Card, Spinner, Modal } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import { auth } from "../firebase";
import "react-toastify/dist/ReactToastify.css";
import { encryptData, decryptData } from "../components/aesUtils"; // 🔐 Make sure path is correct

const fieldTypes = ["text", "number", "email", "date", "file"];

const CustomBlockForm = () => {
  const { blockId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const userId = user?.uid;

  const [fields, setFields] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [savedForms, setSavedForms] = useState([]);
  const [loadingSavedForms, setLoadingSavedForms] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [editingFormId, setEditingFormId] = useState(null);

  const addField = () => {
    setFields([...fields, { name: "", type: "text" }]);
  };

  const handleFieldChange = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const handleInputChange = (name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const toBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  };

  const fetchSavedForms = async () => {
    setLoadingSavedForms(true);
    try {
      const res = await fetch(`https://backend-pbmi.onrender.com/api/saved-forms/${blockId}?userId=${userId}`);
      const data = await res.json();
      setSavedForms(data);
    } catch (err) {
      console.error(err);
      toast.error("Error loading saved forms");
    } finally {
      setLoadingSavedForms(false);
    }
  };

  useEffect(() => {
    if (blockId && userId) {
      fetchSavedForms();
    }
  }, [blockId, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (fields.some((f) => !f.name)) {
      toast.error("Please provide field names for all fields.");
      return;
    }

    try {
      const rawData = {};
      for (const { name, type } of fields) {
        const value = formValues[name];
        if (type === "file" && value instanceof File) {
          rawData[name] = await toBase64(value);
        } else {
          rawData[name] = value;
        }
      }

      const encryptedData = encryptData(rawData); // 🔐 encryption applied

      if (editingFormId) {
        await fetch(`https://backend-pbmi.onrender.com/api/saved-forms/${editingFormId}`, {
          method: "DELETE"
        });
      }

      const payload = {
        userId,
        blockId,
        blockName: state?.blockName || "CustomBlock",
        data: { encrypted: encryptedData },
      };

      console.log("🔐 Encrypted payload to MongoDB:", payload);

      const res = await fetch("https://backend-pbmi.onrender.com/api/save-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");

      toast.success(editingFormId ? "Form updated!" : "Form submitted!");
      setFields([]);
      setFormValues({});
      setEditingFormId(null);
      fetchSavedForms();
    } catch (err) {
      console.error(err);
      toast.error("Submission failed.");
    }
  };

  const handleEdit = (form) => {
    const decrypted = form.data?.encrypted ? decryptData(form.data.encrypted) : form.data;
    const entries = Object.entries(decrypted);

    setFields(entries.map(([name, value]) => ({
      name,
      type: typeof value === "string" && value.startsWith("data:") ? "file" : "text"
    })));

    const newValues = {};
    for (const [key, val] of entries) {
      newValues[key] = val;
    }
    setFormValues(newValues);
    setEditingFormId(form._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (formId) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await fetch(`https://backend-pbmi.onrender.com/api/saved-forms/${formId}`, {
        method: "DELETE"
      });
      toast.success("Deleted successfully");
      fetchSavedForms();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <Button variant="secondary" className="mb-3" onClick={() => navigate(-1)}>
        ← Back to Dashboard
      </Button>
      <h3>Custom Block: {state?.blockName || "Unnamed"}</h3>

      <Form onSubmit={handleSubmit}>
        {fields.map((field, index) => (
          <Card key={index} className="mb-3">
            <Card.Body>
              <Row className="g-2">
                <Col md={4}>
                  <Form.Control
                    placeholder="Field name"
                    value={field.name || ""}
                    onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                    required
                  />
                </Col>
                <Col md={4}>
                  <Form.Select
                    value={field.type || "text"}
                    onChange={(e) => handleFieldChange(index, "type", e.target.value)}
                  >
                    {fieldTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  {field.type === "file" ? (
                    <Form.Control
                      type="file"
                      accept="image/*,application/pdf"
                      placeholder="Upload file"
                      onChange={(e) => handleInputChange(field.name, e.target.files[0])}
                    />
                  ) : (
                    <Form.Control
                      type={field.type}
                      placeholder={`Enter ${field.name}`}
                      value={formValues[field.name] || ""}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                    />
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        ))}

        <div className="d-flex gap-2 mb-3">
          <Button variant="info" onClick={addField}>+ Add Field</Button>
          <Button type="submit" variant="primary">{editingFormId ? "Update" : "Submit"}</Button>
        </div>
      </Form>

      <hr />
      <h4>Saved Entries</h4>
      {loadingSavedForms ? (
        <Spinner animation="border" />
      ) : savedForms.length === 0 ? (
        <p>No saved entries found.</p>
      ) : (
        savedForms.map((form) => {
          const decrypted = form.data?.encrypted ? decryptData(form.data.encrypted) : form.data;

          return (
            <Card key={form._id} className="mb-3">
              <Card.Body>
                <h5>{form.blockName}</h5>
                <p className="text-muted">Submitted on: {new Date(form.createdAt).toLocaleString()}</p>
                {Object.entries(decrypted).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}:</strong>{" "}
                    {typeof value === "string" && value.startsWith("data:image") ? (
                      <img
                        src={value}
                        alt={key}
                        style={{ maxWidth: "100px", maxHeight: "100px", cursor: "pointer" }}
                        onClick={() => setModalImage(value)}
                      />
                    ) : value?.startsWith("data:application/pdf") ? (
                      <a href={value} target="_blank" rel="noopener noreferrer">
                        View PDF
                      </a>
                    ) : (
                      value?.toString()
                    )}
                  </div>
                ))}
                <div className="mt-3 d-flex gap-2">
                  <Button variant="warning" size="sm" onClick={() => handleEdit(form)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(form._id)}>Delete</Button>
                </div>
              </Card.Body>
            </Card>
          );
        })
      )}

      <Modal show={!!modalImage} onHide={() => setModalImage(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Image Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {modalImage && (
            <img
              src={modalImage}
              alt="Full Preview"
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
          }}>
            Download
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CustomBlockForm;
