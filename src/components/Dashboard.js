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
  Form,
  Alert,
  Table,
} from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Dashboard() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlockFields, setSelectedBlockFields] = useState(null);
  const [selectedBlockName, setSelectedBlockName] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [formData, setFormData] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [savedForms, setSavedForms] = useState([]);
  const [loadingSavedForms, setLoadingSavedForms] = useState(false);
  const navigate = useNavigate();

  const optionalFields = ["masked", "qrcode", "withdrawalstatus", "enddateif"];
  const user = auth.currentUser;
  const userId = user?.uid;

  const isYesNoField = (key) => {
    const k = key.toLowerCase();
    return k.startsWith("yes") || k.endsWith("yes_no") || k.includes("yesno");
  };

  useEffect(() => {
    fetch("https://backend-pbmi.onrender.com/api/blocks")
      .then((res) => res.json())
      .then((data) => {
        setBlocks(data);
        toast.success("Blocks loaded successfully!", { autoClose: 2000 });
      })
      .catch((err) => {
        console.error("Error fetching blocks:", err);
        toast.error("Failed to load blocks. Please try again.", {
          autoClose: 3000,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handleBlockClick = async (block) => {
    try {
      const res = await fetch(
        `https://backend-pbmi.onrender.com/api/block-fields/${block._id}`
      );
      if (!res.ok) throw new Error("Failed to fetch block fields");
      const fields = await res.json();

      setSelectedBlockFields(fields);
      setSelectedBlockName(block.name);
      setSelectedBlockId(block._id);

      const init = {};
      Object.keys(fields).forEach((key) => (init[key] = ""));
      setFormData(init);
      setFormSubmitted(false);

      fetchSavedForms(block._id);
    } catch (err) {
      console.error(err);
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

  const handleChange = (e, key) => {
    const value =
      e.target.type === "file" ? e.target.files[0] : e.target.value;
    setFormData({ ...formData, [key]: value });
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

  const renderInputField = (key, label) => {
    const type = getInputType(key);

    if (key.toLowerCase().includes("gender")) {
      return (
        <Form.Select
          value={formData[key]}
          onChange={(e) => handleChange(e, key)}
        >
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
      return (
        <Form.Control
          type="file"
          onChange={(e) => handleChange(e, key)}
          accept="*/*"
        />
      );
    }

    return (
      <Form.Control
        type={type}
        value={formData[key]}
        onChange={(e) => handleChange(e, key)}
      />
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const missingFields = Object.entries(selectedBlockFields).filter(
      ([key]) => !optionalFields.includes(key) && !formData[key]
    );

    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields.");
      setFormSubmitted(false);
      return;
    }

    const cleanedData = { ...formData };
    Object.keys(cleanedData).forEach((k) => {
      if (cleanedData[k] instanceof File) {
        cleanedData[k] = cleanedData[k].name;
      }
    });

    try {
      const res = await fetch("https://backend-pbmi.onrender.com/api/save-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blockId: selectedBlockId,
          blockName: selectedBlockName,
          data: cleanedData,
          userId, // ✅ send user ID
        }),
      });

      if (!res.ok) throw new Error("Failed to save form data");

      toast.success("✅ Form submitted successfully!");
      setFormSubmitted(true);
      setFormData({});

      fetchSavedForms(selectedBlockId);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit form data.");
      setFormSubmitted(false);
    }
  };

  return (
    <Container className="py-4">
      <ToastContainer />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📁 Your Document Blocks</h2>
        <Button variant="danger" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {loading ? (
        <div className="text-center my-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <Row>
          {blocks.map((block) => (
            <Col key={block._id} xs={12} sm={6} md={4} lg={3} className="mb-4">
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

      {selectedBlockFields && (
        <div className="mt-5">
          <h4>📝 Fill Details for: {selectedBlockName}</h4>
          <Form onSubmit={handleSubmit}>
            {Object.entries(selectedBlockFields).map(([key, label]) => (
              <Form.Group className="mb-3" controlId={key} key={key}>
                <Form.Label>
                  {label}{" "}
                  {!optionalFields.includes(key) && (
                    <span className="text-danger">*</span>
                  )}
                </Form.Label>
                {renderInputField(key, label)}
              </Form.Group>
            ))}
            <Button type="submit" variant="primary">
              Submit
            </Button>
          </Form>

          {formSubmitted && (
            <Alert variant="success" className="mt-4">
              🎉 Form submitted successfully!
            </Alert>
          )}

          <hr className="my-5" />

          <h5>📋 Saved Form Data for {selectedBlockName}</h5>

          {loadingSavedForms ? (
            <Spinner animation="border" />
          ) : savedForms.length === 0 ? (
            <p>No saved submissions yet.</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  {Object.keys(savedForms[0].data || {}).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {savedForms.map((form) => (
                  <tr key={form._id}>
                    {Object.keys(savedForms[0].data || {}).map((key) => (
                      <td key={key}>
                        {form.data[key] !== undefined ? form.data[key] : ""}
                      </td>
                    ))}
                    <td>{new Date(form.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}
    </Container>
  );
}
