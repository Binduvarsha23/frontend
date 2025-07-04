import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Card, Row, Col, Spinner } from 'react-bootstrap';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { FaTrash, FaEdit, FaFileAlt, FaUpload, FaPlus } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const blockOptions = [
  'Prescriptions', 'Lab Reports', 'Scans',
  'Vaccinations', 'Doctor Notes', 'Bills'
];

const HealthRecords = () => {
  const [userId, setUserId] = useState('');
  const [records, setRecords] = useState([]);
  const [customBlocks, setCustomBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState('');
  const [formData, setFormData] = useState({ fileName: '', fileData: '' });
  const [showModal, setShowModal] = useState(false);
  const [showBlockCreate, setShowBlockCreate] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
  }, []);

  useEffect(() => {
    if (userId) {
      fetchRecords();
      fetchCustomBlocks();
    }
  }, [userId]);

  const fetchRecords = async () => {
    const res = await axios.get(`https://backend-pbmi.onrender.com/api/health-records?userId=${userId}`);
    setRecords(res.data);
  };

  const fetchCustomBlocks = async () => {
    const res = await axios.get(`https://backend-pbmi.onrender.com/api/health-blocks?userId=${userId}`);
    setCustomBlocks(res.data);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const mime = file.type || 'application/octet-stream';
      const base64 = `data:${mime};base64,${reader.result.split(',')[1]}`;
      setFormData(prev => ({ ...prev, fileData: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const openModal = (block) => {
    setSelectedBlock(block);
    setFormData({ fileName: '', fileData: '' });
    setEditId(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fileName || !formData.fileData) return;

    setLoading(true);
    try {
      if (editId) {
        await axios.patch(`https://backend-pbmi.onrender.com/api/health-records/${editId}`, {
          ...formData,
          blockName: selectedBlock
        });
        setRecords(prev =>
          prev.map(r => r._id === editId ? { ...r, ...formData, blockName: selectedBlock } : r)
        );
        toast.success("File updated successfully ✅");
      } else {
        const res = await axios.post(`https://backend-pbmi.onrender.com/api/health-records/upload`, {
          ...formData,
          blockName: selectedBlock,
          userId,
        });
        setRecords(prev => [...prev, res.data]);
        toast.success("File uploaded successfully ✅");
      }
      setShowModal(false);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error("Upload failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setFormData({
      fileName: record.fileName,
      fileData: record.fileData
    });
    setSelectedBlock(record.blockName);
    setEditId(record._id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this file?")) return;

    setDeletingId(id);
    setRecords(prev => prev.filter(r => r._id !== id));

    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/health-records/${id}`);
      toast.success("File deleted 🗑️");
    } catch (err) {
      toast.error("Delete failed ❌");
      fetchRecords(); // rollback
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewFile = (fileData) => {
    if (!fileData || !fileData.startsWith("data:")) {
      toast.warning("File is still loading or corrupted");
      return;
    }
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(
        `<iframe src="${fileData}" frameborder="0" style="width:100%;height:100%;" allowfullscreen></iframe>`
      );
      newWindow.document.title = "Health Record Viewer";
    } else {
      toast.error("Popup blocked. Please allow popups for this site.");
    }
  };

  const handleDeleteBlock = async (blockName) => {
    const block = customBlocks.find(b => b.blockName === blockName);
    if (!block) return;
    if (!window.confirm(`Delete "${blockName}" and all its files?`)) return;

    try {
      setCustomBlocks(prev => prev.filter(cb => cb.blockName !== blockName));
      setRecords(prev => prev.filter(r => r.blockName !== blockName));

      await axios.delete(`https://backend-pbmi.onrender.com/api/health-blocks/${block._id}`);
      toast.success("Custom block deleted 🗑️");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete block ❌");
      fetchCustomBlocks();
      fetchRecords();
    }
  };

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.blockName]) acc[r.blockName] = [];
    acc[r.blockName].push(r);
    return acc;
  }, {});

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;

    try {
      const res = await axios.post(`https://backend-pbmi.onrender.com/api/health-blocks`, {
        userId,
        blockName: newBlockName.trim()
      });
      setCustomBlocks(prev => [res.data, ...prev]);
      toast.success("Block created ✅");
      setNewBlockName('');
      setShowBlockCreate(false);
    } catch (err) {
      console.error("Block creation error:", err);
      toast.error("Failed to create block ❌");
    }
  };

  return (
    <div className="p-4">
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} />
      <h3 className="mb-4">🩺 Health Records</h3>

      <Row className="mb-4">
        {[...blockOptions, ...customBlocks.map(b => b.blockName)].map((block, i) => (
          <Col xs={6} md={4} lg={3} key={i} className="mb-3">
            <Card className="text-center shadow-sm h-100" style={{ cursor: 'pointer', position: 'relative' }}>
              <Card.Body onClick={() => openModal(block)}>
                <FaUpload size={24} className="text-primary mb-2" />
                <Card.Title className="h6 mb-1">{block}</Card.Title>
                <small className="text-muted">+ Add File</small>
              </Card.Body>
              {customBlocks.find(cb => cb.blockName === block) && (
                <FaTrash
                  size={14}
                  className="position-absolute text-danger"
                  style={{ top: '8px', right: '8px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBlock(block);
                  }}
                />
              )}
            </Card>
          </Col>
        ))}

        <Col xs={6} md={4} lg={3} className="mb-3">
          <Card className="text-center shadow-sm h-100" style={{ cursor: 'pointer' }} onClick={() => setShowBlockCreate(true)}>
            <Card.Body className="d-flex flex-column justify-content-center align-items-center">
              <FaPlus size={24} className="text-success mb-2" />
              <Card.Title className="h6 mb-1">Add Custom Block</Card.Title>
              <small className="text-muted">e.g. Dental, Skin, etc.</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {Object.entries(grouped).map(([block, items]) => (
        <div key={block} className="mb-5">
          <h5 className="fw-bold border-bottom pb-2">{block}</h5>
          <Row>
            {items.map(file => (
              <Col md={6} lg={4} key={file._id} className="mb-3">
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <Card.Title className="text-truncate" title={file.fileName}>
                        <FaFileAlt className="me-2 text-primary" />{file.fileName}
                      </Card.Title>
                      <div className="d-flex gap-2">
                        <FaEdit className="text-warning" style={{ cursor: 'pointer' }} onClick={() => handleEdit(file)} />
                        {deletingId === file._id ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <FaTrash className="text-danger" style={{ cursor: 'pointer' }} onClick={() => handleDelete(file._id)} />
                        )}
                      </div>
                    </div>
                    <small className="text-muted">{new Date(file.createdAt).toLocaleString()}</small>
                    <div className="text-center mt-3">
                      <Button variant="outline-primary" size="sm" onClick={() => handleViewFile(file.fileData)}>
                        View File
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}

      {/* Modal for Upload/Edit */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editId ? `Edit File in ${selectedBlock}` : `Upload to ${selectedBlock}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Custom File Name</Form.Label>
              <Form.Control
                type="text"
                value={formData.fileName}
                onChange={(e) => setFormData(prev => ({ ...prev, fileName: e.target.value }))}
                placeholder="e.g. Son's Health Report"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Choose File</Form.Label>
              <Form.Control type="file" accept="*/*" onChange={handleFileChange} />
            </Form.Group>

            <Button variant="dark" type="submit" className="w-100" disabled={loading}>
              {loading ? (
                <span><Spinner animation="border" size="sm" className="me-2" />Uploading...</span>
              ) : editId ? 'Update' : 'Upload'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal for Custom Block Creation */}
      <Modal show={showBlockCreate} onHide={() => setShowBlockCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Custom Health Block</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateBlock}>
            <Form.Group>
              <Form.Label>Block Name</Form.Label>
              <Form.Control
                type="text"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="e.g. Dental, Physiotherapy"
                required
              />
            </Form.Group>
            <Button type="submit" variant="success" className="mt-3 w-100">Create Block</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default HealthRecords;
