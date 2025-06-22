import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  Form,
  Button,
  Spinner,
  Table,
  Container,
  Modal,
} from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import {
  isYesNoField,
  getInputType,
  convertFileToBase64,
  renderFilePreview,
  getFieldPattern,
  getFieldPlaceholder,
} from "./utils";
import { encryptData, decryptData } from "./aesUtils";

const BASE_URL = "https://backend-pbmi.onrender.com";

const BlockForm = () => {
  const { blockId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [blockName, setBlockName] = useState(state?.blockName || "");
  const [selectedBlockFields, setSelectedBlockFields] = useState({});
  const [formData, setFormData] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [savedForms, setSavedForms] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingSavedForms, setLoadingSavedForms] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [editingFormId, setEditingFormId] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchBlockData();
      fetchSavedForms();
    }
  }, [blockId, userId]);

  const fetchBlockData = async () => {
    setLoadingFields(true);
    try {
      const res = await fetch(`${BASE_URL}/api/block-fields/${blockId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load block fields");

      const visibleFields = {};
      const init = {};

      for (const key in data) {
        const field = data[key];
        if (field.visible !== false) {
          visibleFields[key] = field;
          init[key] = "";
        }
      }

      setSelectedBlockFields(visibleFields);
      setFormData(init);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load block field metadata");
    } finally {
      setLoadingFields(false);
    }
  };

  const fetchSavedForms = async () => {
    setLoadingSavedForms(true);
    try {
      const res = await fetch(`${BASE_URL}/api/saved-forms/${blockId}?userId=${userId}`);
      const data = await res.json();
      setSavedForms(data);
    } catch (err) {
      console.error(err);
      toast.error("Error loading saved forms");
    } finally {
      setLoadingSavedForms(false);
    }
  };

  const handleChange = (e, key) => {
    const value = e.target.type === "file" ? e.target.files[0] : e.target.value;
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleDelete = async (formId) => {
    try {
      setSavedForms((prev) => prev.filter((f) => f._id !== formId));
      const res = await fetch(`${BASE_URL}/api/saved-forms/${formId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
      fetchSavedForms();
    }
  };

  const handleEdit = (form) => {
    const decrypted = form.data?.encrypted ? decryptData(form.data.encrypted) : form.data;
    const editable = {};
    Object.keys(selectedBlockFields).forEach((key) => {
      editable[key] = decrypted[key] || "";
    });
    setFormData(editable);
    setEditingFormId(form._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitted(true);

    const missingFields = Object.entries(selectedBlockFields).filter(
      ([key, field]) => field.required && !formData[key]
    );
    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields.");
      setFormSubmitted(false);
      return;
    }

    try {
      const cleanedData = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value instanceof File) {
          cleanedData[key] = await convertFileToBase64(value);
        } else {
          const pattern = getFieldPattern(key);
          if (pattern && value && !new RegExp(pattern).test(value)) {
            toast.error(`Invalid value for ${key}`);
            setFormSubmitted(false);
            return;
          }
          cleanedData[key] = value;
        }
      }

      const isPasswordBlock = blockName.toLowerCase().includes("password");
      const dataToSend = isPasswordBlock
        ? { encrypted: encryptData(cleanedData) }
        : cleanedData;

      if (editingFormId) {
        await fetch(`${BASE_URL}/api/saved-forms/${editingFormId}`, {
          method: "DELETE",
        });
      }

      const payload = { userId, blockId, blockName, data: dataToSend };

      const res = await fetch(`${BASE_URL}/api/save-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unknown error");

      toast.success(editingFormId ? "Form updated!" : "Form submitted!");
      const init = {};
      Object.keys(selectedBlockFields).forEach((key) => (init[key] = ""));
      setFormData(init);
      setEditingFormId(null);
      fetchSavedForms();
    } catch (err) {
      console.error(err);
      toast.error("Submit failed");
    } finally {
      setFormSubmitted(false);
    }
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <Button variant="secondary" onClick={() => navigate(-1)} className="mb-3">
        Back to Dashboard
      </Button>
      <h3>{blockName}</h3>

      {loadingFields ? (
        <Spinner animation="border" />
      ) : (
        <>
          <Form onSubmit={handleSubmit}>
            {Object.entries(selectedBlockFields).map(([key, field]) => (
              <Form.Group key={key} className="mb-3" controlId={`form_${key}`}>
                <Form.Label>
                  {field.label} {field.required && <span style={{ color: "red" }}>*</span>}
                </Form.Label>
                {isYesNoField(key) ? (
                  <div>
                    <Form.Check
                      inline
                      label="Yes"
                      name={key}
                      type="radio"
                      value="Yes"
                      checked={formData[key] === "Yes"}
                      onChange={(e) => handleChange(e, key)}
                      {...(field.required ? { required: true } : {})}
                    />
                    <Form.Check
                      inline
                      label="No"
                      name={key}
                      type="radio"
                      value="No"
                      checked={formData[key] === "No"}
                      onChange={(e) => handleChange(e, key)}
                      {...(field.required ? { required: true } : {})}
                    />
                  </div>
                ) : getInputType(key) === "file" ? (
                  <Form.Control
                    type="file"
                    onChange={(e) => handleChange(e, key)}
                    {...(field.required ? { required: true } : {})}
                  />
                ) : key.toLowerCase().includes("gender") ? (
                  <Form.Select
                    value={formData[key]}
                    onChange={(e) => handleChange(e, key)}
                    {...(field.required ? { required: true } : {})}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Form.Select>
                ) : (
                  <Form.Control
                    type={getInputType(key)}
                    value={formData[key] || ""}
                    onChange={(e) => handleChange(e, key)}
                    placeholder={getFieldPlaceholder(key)}
                    pattern={getFieldPattern(key)}
                    {...(field.required ? { required: true } : {})}
                  />
                )}
              </Form.Group>
            ))}
            <Button type="submit" disabled={formSubmitted}>
              {editingFormId ? "Update" : "Submit"}
            </Button>
          </Form>

          <hr />
          <h4>Saved Form Data</h4>
          {loadingSavedForms ? (
            <Spinner animation="border" />
          ) : savedForms.length === 0 ? (
            <p>No saved form data found.</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  {Object.keys(
                    savedForms[0].data?.encrypted
                      ? decryptData(savedForms[0].data.encrypted)
                      : savedForms[0].data
                  ).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                  <th>Edit</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {savedForms.map((form) => {
                  const decryptedData = form.data?.encrypted
                    ? decryptData(form.data.encrypted)
                    : form.data;
                  return (
                    <tr key={form._id}>
                      {Object.entries(decryptedData).map(([key, value]) => (
                        <td key={key} style={{ maxWidth: "150px", wordBreak: "break-word" }}>
                          {typeof value === "string" && value.startsWith("data:image") ? (
                            <span
                              style={{ color: "blue", cursor: "pointer" }}
                              onClick={() => setModalImage(value)}
                            >
                              View Image
                            </span>
                          ) : typeof value === "string" && value.startsWith("data:") ? (
                            <span style={{ fontStyle: "italic" }}>File</span>
                          ) : (
                            value?.toString().slice(0, 50) + (value?.length > 50 ? "..." : "")
                          )}
                        </td>
                      ))}
                      <td>
                        <Button variant="warning" onClick={() => handleEdit(form)}>
                          Edit
                        </Button>
                      </td>
                      <td>
                        <Button variant="danger" onClick={() => handleDelete(form._id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
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
          <Button variant="secondary" onClick={() => setModalImage(null)}>
            Close
          </Button>
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

export default BlockForm;