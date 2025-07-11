import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Modal, Form, Card, Row, Col, Spinner } from 'react-bootstrap';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { FaTrash, FaEdit, FaFileAlt, FaUpload, FaPlus, FaHeart } from 'react-icons/fa'; // Import FaHeart
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const blockOptions = [
  'Prescriptions', 'Lab Reports', 'Scans',
  'Vaccinations', 'Doctor Notes', 'Bills'
];

// File Preview Modal Component
const FilePreviewModal = ({ show, onHide, file }) => {
  if (!file) return null;

  const getPreviewContent = () => {
    if (!file.fileData) {
      return <p>No file data available for preview. Please ensure the file was uploaded correctly.</p>;
    }

    const parts = file.fileData.split(';');
    const mimeType = parts[0].split(':')[1];

    if (mimeType.startsWith('image/')) {
      return <img src={file.fileData} alt={file.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />;
    } else if (mimeType === 'application/pdf') {
      // Use embed for PDFs for better browser compatibility in modals
      return <embed src={file.fileData} type="application/pdf" width="100%" height="500px" />;
    } else if (mimeType.startsWith('text/')) {
        // Decode base64 text for preview
        try {
            const base64Content = file.fileData.split(',')[1];
            const decodedContent = atob(base64Content);
            return (
                <div style={{ maxHeight: '500px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #eee', padding: '10px', backgroundColor: '#f9f9f9', textAlign: 'left' }}>
                    {decodedContent}
                </div>
            );
        } catch (e) {
            console.error("Error decoding text file for preview:", e);
            return <p>Could not decode text file content for preview. Please download the file to view it.</p>;
        }
    } else {
      // Fallback for unsupported types
      return (
        <div className="text-center">
          <p>Preview not available for this file type (<code>{mimeType}</code>).</p>
          <p>Commonly supported preview types include images (JPG, PNG), PDFs, and plain text files.</p>
          <p>Please click "Download" to view the file in your default application.</p>
        </div>
      );
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{file.fileName}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        {getPreviewContent()}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
        <Button variant="primary" href={file.fileData} download={file.fileName}>Download</Button>
      </Modal.Footer>
    </Modal>
  );
};


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
  const [showFilePreviewModal, setShowFilePreviewModal] = useState(false); // New state for preview modal
  const [fileToPreview, setFileToPreview] = useState(null); // New state to hold file data for preview

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
    try {
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/health-records?userId=${userId}`);
      setRecords(res.data);
    } catch (err) {
      console.error('Error fetching health records:', err);
      toast.error("Failed to fetch health records.");
    }
  };

  const fetchCustomBlocks = async () => {
    try {
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/health-blocks?userId=${userId}`);
      setCustomBlocks(res.data);
    } catch (err) {
      console.error('Error fetching custom blocks:', err);
      toast.error("Failed to fetch custom blocks.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const mime = file.type || 'application/octet-stream';
      const base64 = `data:${mime};base64,${reader.result.split(',')[1]}`;
      setFormData(prev => ({ ...prev, fileName: file.name, fileData: base64 })); // Pre-fill filename
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
    if (!formData.fileName || !formData.fileData) {
      toast.error("File name and file data are required.");
      return;
    }

    setLoading(true);
    const originalRecords = records; // Store original state for rollback
    const tempId = `temp-${Date.now()}`; // Temporary ID for optimistic update

    try {
      if (editId) {
        // For edit, we update the existing record optimistically
        setRecords(prev =>
          prev.map(r => r._id === editId ? { ...r, ...formData, blockName: selectedBlock } : r)
        );
        toast.info("Updating file...");
        await axios.patch(`https://backend-pbmi.onrender.com/api/health-records/${editId}`, {
          ...formData,
          blockName: selectedBlock
        });
        toast.success("File updated successfully ✅");
      } else {
        // For add, we add a temporary record optimistically
        const newRecordOptimistic = {
          _id: tempId,
          fileName: formData.fileName,
          fileData: formData.fileData,
          blockName: selectedBlock,
          userId,
          createdAt: new Date().toISOString(), // Add a timestamp for consistent display
          favorite: false // Default favorite status
        };
        setRecords(prev => [...prev, newRecordOptimistic]);
        toast.info("Uploading file...");

        const res = await axios.post(`https://backend-pbmi.onrender.com/api/health-records/upload`, {
          ...formData,
          blockName: selectedBlock,
          userId,
        });
        // Replace the optimistic record with the actual one from the backend
        setRecords(prev => prev.map(r => r._id === tempId ? res.data.file : r));
        toast.success("File uploaded successfully ✅");
      }
      setShowModal(false);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error("Upload failed ❌");
      // Rollback optimistic update
      setRecords(originalRecords); // Revert to original state
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
    setDeletingId(id);
    const originalRecords = records; // Store original state for rollback
    // Optimistic UI update for deletion
    setRecords(prev => prev.filter(r => r._id !== id));
    toast.info("Deleting file...");

    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/health-records/${id}`);
      toast.success("File deleted 🗑️");
    } catch (err) {
      toast.error("Delete failed ❌");
      setRecords(originalRecords); // Rollback by re-fetching if delete fails
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewFile = (file) => { // Now accepts the full file object
    setFileToPreview(file);
    setShowFilePreviewModal(true);
  };

  const handleDeleteBlock = async (blockName) => {
    const block = customBlocks.find(b => b.blockName === blockName);
    if (!block) return;

    const originalCustomBlocks = customBlocks; // Store original state for rollback
    const originalRecords = records; // Store original records for rollback

    try {
      // Optimistic UI update for block deletion
      setCustomBlocks(prev => prev.filter(cb => cb.blockName !== blockName));
      setRecords(prev => prev.filter(r => r.blockName !== blockName));
      toast.info(`Deleting "${blockName}" block...`);

      await axios.delete(`https://backend-pbmi.onrender.com/api/health-blocks/${block._id}`);
      toast.success("Custom block deleted 🗑️");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete block ❌");
      setCustomBlocks(originalCustomBlocks); // Rollback
      setRecords(originalRecords); // Rollback
    }
  };

  // New function to handle toggling favorite status
  const handleFavoriteToggle = async (id, currentFavorite) => {
    // Optimistic UI update: immediately change the color
    setRecords(prevRecords =>
      prevRecords.map(record =>
        record._id === id ? { ...record, favorite: !currentFavorite } : record
      )
    );

    try {
      await axios.patch(`https://backend-pbmi.onrender.com/api/health-records/${id}/favorite`);
      toast.success(currentFavorite ? "Removed from favorites" : "Added to favorites ❤️");
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast.error("Failed to update favorite status ❌");
      // Rollback UI if API call fails
      setRecords(prevRecords =>
        prevRecords.map(record =>
          record._id === id ? { ...record, favorite: currentFavorite } : record
        )
      );
    }
  };

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.blockName]) acc[r.blockName] = [];
    acc[r.blockName].push(r);
    return acc;
  }, {});

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    if (!newBlockName.trim()) {
      toast.error("Block name cannot be empty.");
      return;
    }

    const originalCustomBlocks = customBlocks; // Store original state for rollback
    const tempId = `temp-${Date.now()}`; // Temporary ID for optimistic update

    const newBlockOptimistic = {
      _id: tempId,
      blockName: newBlockName.trim(),
      userId,
      createdAt: new Date().toISOString(), // Add a timestamp for consistent display
    };

    // Optimistically add the new block to the state
    setCustomBlocks(prev => [...prev, newBlockOptimistic]);
    toast.info("Creating block...");

    try {
      const res = await axios.post(`https://backend-pbmi.onrender.com/api/health-blocks`, {
        userId,
        blockName: newBlockName.trim()
      });
      // Replace the optimistic block with the actual one from the backend
      setCustomBlocks(prev => prev.map(b => b._id === tempId ? res.data : b));
      toast.success("Block created ✅");
      setNewBlockName('');
      setShowBlockCreate(false);
    } catch (err) {
      console.error("Block creation error:", err);
      toast.error("Failed to create block ❌");
      setCustomBlocks(originalCustomBlocks); // Rollback
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
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Card.Title className="text-truncate" title={file.fileName}>
                        <FaFileAlt className="me-2 text-primary" />{file.fileName}
                      </Card.Title>
                      <div className="d-flex gap-2 align-items-center"> {/* Added align-items-center for vertical alignment */}
                        {/* Favorite Icon */}
                        <FaHeart
                          className="me-1"
                          style={{
                            cursor: 'pointer',
                            color: file.favorite ? 'red' : 'gray', // Conditional color
                            transition: 'color 0.1s ease-in-out' // Fast color change
                          }}
                          onClick={() => handleFavoriteToggle(file._id, file.favorite)}
                          title={file.favorite ? "Remove from favorites" : "Add to favorites"}
                        />
                        <FaEdit className="text-warning" style={{ cursor: 'pointer' }} onClick={() => handleEdit(file)} title="Edit File" />
                        {deletingId === file._id ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <FaTrash className="text-danger" style={{ cursor: 'pointer' }} onClick={() => handleDelete(file._id)} title="Delete File" />
                        )}
                      </div>
                    </div>
                    <small className="text-muted">{new Date(file.createdAt).toLocaleString()}</small>
                    <div className="text-center mt-3">
                      <Button variant="outline-primary" size="sm" onClick={() => handleViewFile(file)}> {/* Pass the whole file object */}
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

      {/* File Preview Modal */}
      <FilePreviewModal
        show={showFilePreviewModal}
        onHide={() => setShowFilePreviewModal(false)}
        file={fileToPreview}
      />
    </div>
  );
};

export default HealthRecords;
