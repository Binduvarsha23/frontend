import React, { useState, useRef } from "react";
import { Button, Spinner, Form, Table } from "react-bootstrap";
import { toast } from "react-toastify";
import CryptoJS from "crypto-js";

const AES_SECRET_KEY = "your-very-secure-secret-key"; // 🔒 Use .env in production

const FormComponent = ({
  selectedBlockFields,
  selectedBlockName,
  selectedBlockId,
  formData,
  setFormData,
  formSubmitted,
  setFormSubmitted,
  savedForms,
  setSavedForms,
  loadingSavedForms,
  setLoadingSavedForms,
  blocks,
  userId,
  fetchRecentUploads,
  handleBackToBlocks,
  optionalFields,
  isYesNoField,
  getInputType,
  convertFileToBase64,
  renderFilePreview,
  fetchSavedForms,
}) => {
  const formRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e, key) => {
    const value = e.target.type === "file" ? e.target.files[0] : e.target.value;
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const encrypt = (data) => CryptoJS.AES.encrypt(data, AES_SECRET_KEY).toString();

  const decrypt = (ciphertext) => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, AES_SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      console.error("Decryption error:", err);
      return "[Decryption Error]";
    }
  };

  const renderInputField = (key, label) => {
    const type = getInputType(key);

    if (key.toLowerCase().includes("gender")) {
      return (
        <Form.Select value={formData[key] || ""} onChange={(e) => handleChange(e, key)}>
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </Form.Select>
      );
    }

    if (isYesNoField(key)) {
      return (
        <div>
          <Form.Check
            inline
            label="Yes"
            name={key}
            type="radio"
            value="Yes"
            checked={formData[key] === "Yes"}
            onChange={(e) => handleChange(e, key)}
          />
          <Form.Check
            inline
            label="No"
            name={key}
            type="radio"
            value="No"
            checked={formData[key] === "No"}
            onChange={(e) => handleChange(e, key)}
          />
        </div>
      );
    }

    if (type === "file") {
      return <Form.Control type="file" onChange={(e) => handleChange(e, key)} accept="*/*" />;
    }

    return (
      <Form.Control
        type={type}
        value={formData[key] || ""}
        onChange={(e) => handleChange(e, key)}
      />
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const missingFields = Object.entries(selectedBlockFields).filter(
      ([key]) => !optionalFields.includes(key) && !formData[key]
    );

    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields.");
      setFormSubmitted(false);
      setIsSubmitting(false);
      return;
    }

    try {
      const encryptedData = {};

      for (const [key, value] of Object.entries(formData)) {
        let rawValue = value instanceof File ? await convertFileToBase64(value) : value;
        encryptedData[key] = encrypt(rawValue);
      }

      const res = await fetch("https://backend-pbmi.onrender.com/api/save-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blockId: selectedBlockId,
          blockName: selectedBlockName,
          data: encryptedData,
          userId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Unknown error");
      }

      toast.success("Form submitted successfully!");
      setFormSubmitted(true);
      setFormData({});
      formRef.current?.reset(); // Clear file inputs and form visually
      fetchSavedForms(selectedBlockId);
      fetchRecentUploads(blocks);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit form data.");
      setFormSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Button variant="secondary" className="mb-3" onClick={handleBackToBlocks}>
        ← Back to Blocks
      </Button>

      <h3>Form for Block: {selectedBlockName}</h3>
      <Form onSubmit={handleSubmit} ref={formRef}>
        {Object.entries(selectedBlockFields).map(([key, label]) => {
          const isRequired = !optionalFields.includes(key);
          return (
            <Form.Group key={key} className="mb-3" controlId={`form_${key}`}>
              <Form.Label>
                {label} {isRequired && <span style={{ color: "red" }}>*</span>}
              </Form.Label>
              {renderInputField(key, label)}
            </Form.Group>
          );
        })}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting the form, please wait..." : "Submit"}
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
              {Object.keys(savedForms[0].data).map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {savedForms.map((form) => (
              <tr key={form._id}>
                {Object.entries(form.data).map(([key, value]) => {
                  const decrypted = decrypt(value);
                  return (
                    <td key={key} style={{ maxWidth: "150px", wordBreak: "break-word" }}>
                      {decrypted.startsWith("data:")
                        ? renderFilePreview(decrypted)
                        : decrypted}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default FormComponent;
