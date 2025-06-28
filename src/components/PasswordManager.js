// File: src/pages/PasswordManager.jsx
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
    FaEdit,
    FaTrashAlt,
    FaPlusCircle,
    FaRegCopy, // Copy icon
    FaEye, // Show password icon
    FaEyeSlash, // Hide password icon
    FaLock, // Used for the main vault icon
    FaKey, // General password icon
    FaUniversity, // Banking icon
    FaChartLine, // Investment icon
    FaEnvelope, // Email icon
    FaUsers, // Social Media icon
    FaBriefcase, // Work icon
    FaUserCircle // Personal icon
} from 'react-icons/fa';
import { Modal, Button, Form } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './PasswordManager.css'; // Ensure this CSS file is correctly linked and updated
import { decryptData, encryptData } from './aesUtils';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const defaultCategories = [
    'Banking',
    'Investment',
    'Email',
    'Social Media',
    'Work',
    'Personal'
];

const categoryConfig = {
    'All Passwords': { icon: FaKey, color: '#6a6a6a' },
    'Banking': { icon: FaUniversity, color: '#88e0b6' },
    'Investment': { icon: FaChartLine, color: '#b688e0' },
    'Email': { icon: FaEnvelope, color: '#88b6e0' },
    'Social Media': { icon: FaUsers, color: '#e088b6' },
    'Work': { icon: FaBriefcase, color: '#e0c888' },
    'Personal': { icon: FaUserCircle, color: '#88e0e0' },
};

const PasswordManager = () => {
    const [userId, setUserId] = useState(null);
    const [passwords, setPasswords] = useState([]);
    const [customBlocks, setCustomBlocks] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All Passwords');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState({ username: '', password: '', website: '', category: '' });
    const [showPassword, setShowPassword] = useState({});

    const [showCustomModal, setShowCustomModal] = useState(false);
    const [newBlockName, setNewBlockName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const formRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchPasswords = async () => {
        try {
            const res = await axios.get(`https://backend-pbmi.onrender.com/api/passwords?userId=${userId}`);
            const decrypted = res.data.map((entry) => ({
                ...entry,
                data: decryptData(entry.data),
            }));
            setPasswords(decrypted);
        } catch (err) {
            toast.error('Failed to fetch passwords');
        }
    };

    const fetchCustomBlocks = async () => {
        try {
            const res = await axios.get(`https://backend-pbmi.onrender.com/api/password-categories?userId=${userId}`);
            setCustomBlocks(res.data.map(b => b.blockName));
        } catch (err) {
            toast.error('Failed to fetch custom blocks');
        }
    };

    useEffect(() => {
        if (userId) {
            fetchPasswords();
            fetchCustomBlocks();
        }
    }, [userId]);

    useEffect(() => {
        if (!editing && selectedCategory !== 'All Passwords') {
            setFormData(prev => ({ ...prev, category: selectedCategory }));
        }
    }, [selectedCategory, editing]);

    useEffect(() => {
        if (showForm && formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [showForm]);


    const handleSave = async () => {
        if (!formData.username || !formData.password || !formData.website || !formData.category || !userId) {
            toast.error('Please fill all fields (Website, Username/Email, Password).');
            return;
        }

        const urlRegex = /^(https?:\/\/)?([\w\d]+\.)?[\w\d]+\.[\w\d]+(\/[\w\d-._~:/?#[\]@!$&'()*+,;=]*)?$/i;
        if (!urlRegex.test(formData.website)) {
            toast.error('Please enter a valid website URL (e.g., example.com, www.example.com).');
            return;
        }

        const encrypted = encryptData({
            username: formData.username,
            password: formData.password,
            website: formData.website,
            updatedAt: new Date().toISOString(),
        });

        const payload = {
            userId,
            blockName: formData.category,
            data: encrypted,
        };

        try {
            if (editing) {
                await axios.delete(`https://backend-pbmi.onrender.com/api/passwords/${editing._id}`);
            }
            await axios.post('https://backend-pbmi.onrender.com/api/passwords', payload);
            toast.success('Saved successfully');
            fetchPasswords();
            setShowForm(false);
            setEditing(null);
            setFormData({ username: '', password: '', website: '', category: '' });
        } catch (err) {
            toast.error('Failed to save');
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`https://backend-pbmi.onrender.com/api/passwords/${id}`);
            toast.success('Deleted');
            fetchPasswords();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.info('Copied to clipboard!');
    };

    const togglePasswordVisibility = (id) => {
        setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddCustomBlock = async () => {
        if (!newBlockName.trim()) {
            toast.error('Enter a block name');
            return;
        }
        if (defaultCategories.includes(newBlockName) || customBlocks.includes(newBlockName)) {
            toast.error('Category already exists');
            return;
        }
        try {
            await axios.post('https://backend-pbmi.onrender.com/api/password-categories', {
                userId,
                blockName: newBlockName.trim(),
            });
            toast.success('Custom block added');
            setShowCustomModal(false);
            setNewBlockName('');
            fetchCustomBlocks();
        } catch (err) {
            toast.error('Failed to add custom block');
        }
    };

    const handleDeleteCustomBlock = async (blockName) => {
        if (!window.confirm(`Are you sure you want to delete the category "${blockName}"? This will also delete all passwords associated with it.`)) {
            return;
        }

        try {
            await axios.delete(`https://backend-pbmi.onrender.com/api/password-categories`, {
                params: { userId, blockName }
            });
            toast.success(`Custom category "${blockName}" and its associated passwords deleted.`);

            if (selectedCategory === blockName) {
                setSelectedCategory('All Passwords');
            }
            fetchCustomBlocks();
            fetchPasswords();
        } catch (err) {
            console.error("Error deleting custom block:", err);
            toast.error('Failed to delete custom block. Please check server logs.');
        }
    };

    const allCategories = [...defaultCategories, ...customBlocks];

    const filtered = passwords.filter(p => {
        const inCategory = selectedCategory === 'All Passwords' || p.blockName === selectedCategory;
        const query = searchQuery.toLowerCase();
        const matchesSearch =
            p.data.website.toLowerCase().includes(query) ||
            p.data.username.toLowerCase().includes(query) ||
            p.blockName.toLowerCase().includes(query);
        return inCategory && matchesSearch;
    });

    const categoryCounts = allCategories.reduce((acc, c) => {
        acc[c] = passwords.filter(p => p.blockName === c).length;
        return acc;
    }, { 'All Passwords': passwords.length });

    const getCategoryIcon = (categoryName) => {
        const config = categoryConfig[categoryName];
        if (config) {
            return config.icon;
        }
        return FaKey;
    };

    const getCategoryColor = (categoryName) => {
        const config = categoryConfig[categoryName];
        if (config) {
            return config.color;
        }
        return '#cccccc';
    };


    return (
        <div className="password-manager-container">
            <ToastContainer />

            <div className="header-section">
                <div className="app-title">
                    <div>
                        <h1>Password Vault</h1>
                        <p>Securely manage all your passwords and credentials</p>
                    </div>
                </div>
            </div>

            <h3 className="section-title">Password Categories</h3>
            <div className="category-grid">
                <div
                    className={`category-card ${selectedCategory === 'All Passwords' ? 'active' : ''}`}
                    onClick={() => {
                        setSelectedCategory('All Passwords');
                        setShowForm(false);
                    }}
                    style={{ '--card-color': getCategoryColor('All Passwords') }}
                >
                    <div className="card-icon-wrapper">
                        <FaKey className="card-icon" />
                    </div>
                    <h5>All Passwords</h5>
                    <p className="category-count">{categoryCounts['All Passwords'] || 0}</p>
                </div>

                {allCategories.map((catName) => {
                    if (catName === 'All Passwords') return null;

                    const Icon = getCategoryIcon(catName);
                    const color = getCategoryColor(catName);

                    return (
                        <div
                            key={catName}
                            className={`category-card ${selectedCategory === catName ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedCategory(catName);
                                setShowForm(false);
                            }}
                            style={{ '--card-color': color }}
                        >
                            <div className="card-icon-wrapper">
                                <Icon className="card-icon" />
                            </div>
                            <h5>{catName}</h5>
                            <p className="category-count">{categoryCounts[catName] || 0}</p>
                            {customBlocks.includes(catName) && (
                                <FaTrashAlt className="delete-block-icon" onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCustomBlock(catName);
                                }} />
                            )}
                        </div>
                    );
                })}

                <div className="category-card add-block-card" onClick={() => setShowCustomModal(true)}>
                    <FaPlusCircle className="card-icon" id='fa' />
                    <h5>Add Custom</h5>
                </div>
            </div>

            <div className="password-list-section">
                <div className="list-header">
                    {/* Left half: Category title and Add icon */}
                    <div className="list-header-left">
                        <h4>{selectedCategory}</h4>
                        {selectedCategory !== 'All Passwords' && (
                            <FaPlusCircle className="add-icon" onClick={() => {
                                setShowForm(true);
                                setEditing(null);
                                setFormData({ username: '', password: '', website: '', category: selectedCategory });
                            }} />
                        )}
                    </div>
                    {/* Right half: Search bar */}
                    <div className="list-header-right">
                        <Form.Control
                            type="text"
                            placeholder="Search by username, website, or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-bar"
                        />
                    </div>
                </div>
                <div className="password-cards-grid">
                    {filtered.length === 0 ? (
                        <p className="no-passwords-message">No passwords found in this category.</p>
                    ) : (
                        filtered.map((entry) => {
                            const ItemIcon = getCategoryIcon(entry.blockName);
                            const itemColor = getCategoryColor(entry.blockName);

                            return (
                                <div key={entry._id} className="password-card-item">
                                    <div className="item-header">
                                        <div className="item-title-group">
                                            <div className="item-icon-wrapper" style={{ '--item-icon-color': itemColor }}>
                                                <ItemIcon />
                                            </div>
                                            <div>
                                                <strong>{entry.data.website}</strong>
                                                <span className="category-tag" style={{ backgroundColor: itemColor }}>{entry.blockName}</span>
                                            </div>
                                        </div>
                                        <div className="action-buttons">
                                            <button className="icon-btn edit-btn" onClick={() => {
                                                setEditing(entry);
                                                setFormData({
                                                    username: entry.data.username,
                                                    password: entry.data.password,
                                                    website: entry.data.website,
                                                    category: entry.blockName
                                                });
                                                setShowForm(true);
                                                if (formRef.current) {
                                                    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }
                                            }}><FaEdit /></button>
                                            <button className="icon-btn delete-btn" onClick={() => handleDelete(entry._id)}><FaTrashAlt /></button>
                                        </div>
                                    </div>
                                    <div className="item-details">
                                        <p>
                                            <span className="detail-label">Username:</span>
                                            <span className="detail-value">{entry.data.username}</span>
                                            <FaRegCopy className="copy-icon" onClick={() => handleCopyToClipboard(entry.data.username)} />
                                        </p>
                                        <p>
                                            <span className="detail-label">Password:</span>
                                            <span className="detail-value">
                                                {showPassword[entry._id] ? entry.data.password : '••••••••••'}
                                            </span>
                                            {showPassword[entry._id] ? (
                                                <FaEyeSlash className="visibility-icon" onClick={() => togglePasswordVisibility(entry._id)} />
                                            ) : (
                                                <FaEye className="visibility-icon" onClick={() => togglePasswordVisibility(entry._id)} />
                                            )}
                                            <FaRegCopy className="copy-icon" onClick={() => handleCopyToClipboard(entry.data.password)} />
                                        </p>
                                        <p>
                                            <span className="detail-label">Website:</span>
                                            <a href={`https://${entry.data.website}`} target="_blank" rel="noopener noreferrer" className="detail-value website-link">{entry.data.website}</a>
                                        </p>
                                        <p className="last-updated">Last updated: {new Date(entry.data.updatedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {showForm && (
                <div className="password-form-container" ref={formRef}>
                    <h3>{editing ? `Edit ${editing.data.website}` : `Add New Password in ${selectedCategory}`}</h3>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Website Name</Form.Label>
                            <Form.Control type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="e.g., Google" />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Username/Email</Form.Label>
                            <Form.Control type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="e.g., your_email@example.com" />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" />
                        </Form.Group>
                        <div className="form-actions">
                            <Button variant="secondary" onClick={() => {
                                setShowForm(false);
                                setEditing(null);
                                setFormData({ username: '', password: '', website: '', category: '' });
                            }}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
                        </div>
                    </Form>
                </div>
            )}

            <Modal show={showCustomModal} onHide={() => setShowCustomModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add Custom Category</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Category Name</Form.Label>
                        <Form.Control type="text" value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} placeholder="e.g., My Personal Apps" />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCustomModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleAddCustomBlock}>Add</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default PasswordManager;