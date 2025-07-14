import React, { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy load FieldConfigEditor
const FieldConfigEditor = lazy(() => import('./FieldConfigEditor'));

const BASE_URL = 'https://backend-pbmi.onrender.com';
const MAIN_ADMIN = 'binduvarshasunkara@gmail.com';

// Helper for consistent styling (you'd replace this with a CSS framework)
const style = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  section: {
    marginBottom: '30px',
    padding: '20px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  heading: {
    color: '#333',
    borderBottom: '2px solid #007bff',
    paddingBottom: '10px',
    marginBottom: '20px',
  },
  button: {
    padding: '10px 15px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#007bff',
    color: 'white',
    fontSize: '1em',
    transition: 'background-color 0.2s ease',
    marginRight: '10px',
    marginBottom: '5px', // Added for better spacing on mobile
  },
  input: {
    padding: '10px',
    margin: '5px 0',
    borderRadius: '5px',
    border: '1px solid #ccc',
    width: 'calc(100% - 22px)', // Account for padding and border
    boxSizing: 'border-box',
  },
  select: {
    padding: '10px',
    margin: '5px 0',
    borderRadius: '5px',
    border: '1px solid #ccc',
    width: 'calc(100% - 22px)',
    boxSizing: 'border-box',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '15px',
  },
  th: {
    border: '1px solid #ddd',
    padding: '12px',
    textAlign: 'left',
    backgroundColor: '#f2f2f2',
  },
  td: {
    border: '1px solid #ddd',
    padding: '12px',
    verticalAlign: 'top',
  },
  adCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '15px',
    backgroundColor: '#f9f9f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mediaPreview: {
    maxWidth: '100%',
    height: 'auto',
    marginTop: '10px',
    borderRadius: '4px',
  },
  // Responsive styles using media queries (simplified for inline)
  // In a real app, you'd use a CSS file or styled-components/emotion
  '@media (max-width: 768px)': {
    input: {
      width: '100%',
    },
    select: {
      width: '100%',
    },
    button: {
      width: '100%',
      marginBottom: '10px',
    },
    flexContainer: { // New style for wrapping form elements
      flexDirection: 'column',
      alignItems: 'stretch',
    }
  },
};

const AdminPanel = () => {
  const [user, setUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState(null);
  const [accessList, setAccessList] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [ads, setAds] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('readonly');

  const [editAdId, setEditAdId] = useState(null); // State to hold the ID of the ad being edited
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adFile, setAdFile] = useState(null); // Changed from adBase64File to adFile for clarity
  const [adPreviewUrl, setAdPreviewUrl] = useState(null); // For direct object URL preview

  const [newAd, setNewAd] = useState({
    type: 'banner',
    dimensions: ['16:9'],
    contentType: 'image',
    startTime: '',
    endTime: '',
    priority: 1,
    platform: 'both',
    redirectUrl: '',
    ctaText: '',
    sequence: 1,
    header: '',
    summary: '',
    userOptions: [], // Assuming this is an array of strings, or similar
    status: 'active',
    comment: '',
  });

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        fetchRole(u.email);
      } else {
        setAccessDenied(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchRole = useCallback(async (email) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/admin-access/role`, {
        headers: { 'admin-email': email },
      });
      if (res.data.role || email === MAIN_ADMIN) {
        setRole(email === MAIN_ADMIN ? 'superadmin' : res.data.role);
      } else {
        setAccessDenied(true);
      }
    } catch (err) {
      console.error("Error fetching role:", err);
      setAccessDenied(true);
      toast.error('Failed to verify admin role.');
    }
  }, []);

  // Data Fetching based on role and user
  useEffect(() => {
    if (!user || !role) return;

    fetchAllBlockFields();
    fetchAds();

    if (role === 'superadmin') {
      axios.get(`${BASE_URL}/api/admin-access/all`, {
        headers: { 'admin-email': user.email },
      })
      .then(res => setAccessList(res.data))
      .catch(err => {
        console.error("Error fetching access list:", err);
        toast.error('Failed to load admin access list.');
      });
    }
  }, [role, user, fetchRole]); // Added fetchRole to dependency array as it's a useCallback

  const fetchAllBlockFields = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/admin-field-config/all-blocks-fields`, {
        headers: { 'admin-email': user.email },
      });
      setBlocks(res.data);
    } catch (err) {
      console.error("Error fetching block fields:", err);
      toast.error('Failed to load block fields');
    }
  }, [user]);

  const fetchAds = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/ads/admin/all`, {
        headers: { 'admin-email': user.email },
      });
      // Filter out expired ads on the client-side for immediate display
      setAds(res.data.filter(ad => new Date(ad.endTime) > new Date()));
    } catch (err) {
      console.error("Error fetching ads:", err);
      toast.error(err.response?.data?.error || 'Failed to fetch ads');
    }
  }, [user]);

  const resetAdForm = useCallback(() => {
    setNewAd({
      type: 'banner', dimensions: ['16:9'], contentType: 'image', startTime: '', endTime: '',
      priority: 1, platform: 'both', redirectUrl: '', ctaText: '', sequence: 1,
      header: '', summary: '', userOptions: [], status: 'active', comment: ''
    });
    setAdFile(null);
    if (adPreviewUrl) URL.revokeObjectURL(adPreviewUrl); // Clean up object URL
    setAdPreviewUrl(null);
    setEditAdId(null);
  }, [adPreviewUrl]); // adPreviewUrl in dependency to ensure clean up

  const handleEditAd = useCallback((ad) => {
    setEditAdId(ad._id);
    // Format dates to "YYYY-MM-DDTHH:mm" for datetime-local input
    const formattedStartTime = ad.startTime ? new Date(ad.startTime).toISOString().slice(0, 16) : '';
    const formattedEndTime = ad.endTime ? new Date(ad.endTime).toISOString().slice(0, 16) : '';

    setNewAd({
      ...ad,
      dimensions: ad.dimensions || ['16:9'],
      userOptions: ad.userOptions || [],
      startTime: formattedStartTime,
      endTime: formattedEndTime,
    });

    // Set preview if contentBase64 or fileUrl exists
    if (ad.contentBase64) {
      setAdPreviewUrl(ad.contentBase64); // If backend sends base64 directly
    } else if (ad.fileUrl) {
      setAdPreviewUrl(ad.fileUrl); // If backend sends a direct file URL
    } else {
      setAdPreviewUrl(null);
    }
    setAdFile(null); // Clear adFile as we're editing an existing one, unless a new file is uploaded
  }, []);


  const handleAdChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewAd(prev => ({
      ...prev,
      [name]: name === 'dimensions' ? [value] : value, // Keep dimensions as array
    }));
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    setAdFile(file);
    if (adPreviewUrl && !adPreviewUrl.startsWith('data:')) { // Only revoke if it's an object URL, not base64
      URL.revokeObjectURL(adPreviewUrl);
    }
    if (file) {
      setAdPreviewUrl(URL.createObjectURL(file)); // Create object URL for preview
    } else {
      // If file is cleared, and we're editing, try to show the original content again
      const originalAd = ads.find(ad => ad._id === editAdId);
      if (originalAd?.contentBase64) {
        setAdPreviewUrl(originalAd.contentBase64);
      } else if (originalAd?.fileUrl) {
        setAdPreviewUrl(originalAd.fileUrl);
      } else {
        setAdPreviewUrl(null);
      }
    }
  }, [adPreviewUrl, editAdId, ads]);

  const handleCreateAd = async () => {
    setIsSubmitting(true);
    try {
      if (!adFile && !editAdId && !adPreviewUrl) { // If creating, need a new file. If editing, need new file or existing preview
        toast.error('Please upload a valid file or select one for update.');
        return;
      }

      const startTime = new Date(newAd.startTime);
      const endTime = new Date(newAd.endTime);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        toast.error('Please select valid start and end times.');
        return;
      }
      if (endTime <= startTime) {
        toast.error('End time must be after start time');
        return;
      }
      // Only check past for creation or if start time is changed during edit
      if (!editAdId && startTime < new Date()) {
        toast.error('Start time cannot be in the past for new ads.');
        return;
      }

      const formData = new FormData();
      Object.entries(newAd).forEach(([key, value]) => {
        if (key === 'userOptions' || key === 'dimensions') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
      });

      if (adFile) {
        formData.append('file', adFile); // Append the actual file object
      }

      const headers = { 'admin-email': user.email };

      if (editAdId) {
        // For updates, send newAd object directly, formData only if file changes
        // If file is not changed, the backend should retain the existing file.
        // If it sends a file, then multipart/form-data. Otherwise, application/json.
        // Simpler for now: always use FormData if there's a file, even if it's the old one, or if new file is selected.
        // If your backend expects application/json for non-file updates, you'll need to separate this logic.
        // For simplicity, assuming backend handles `file` being optional during PUT.
        if (adFile) { // If a new file is chosen, send FormData
            await axios.put(`${BASE_URL}/api/ads/${editAdId}`, formData, {
                headers: { ...headers, 'Content-Type': 'multipart/form-data' }
            });
        } else { // No new file, send JSON data
            await axios.put(`${BASE_URL}/api/ads/${editAdId}`, newAd, {
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }
        toast.success('Ad updated!');
      } else {
        await axios.post(`${BASE_URL}/api/ads`, formData, {
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data',
          },
        });
        toast.success('Ad created!');
      }

      fetchAds(); // Refresh ad list
      resetAdForm(); // Reset form after submission
    } catch (err) {
      console.error("Error submitting ad:", err.response?.data || err);
      toast.error(err.response?.data?.error || 'Failed to submit ad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdminAccess = async () => {
    if (!newAdminEmail) return toast.error('Email required');
    if (newAdminEmail === MAIN_ADMIN) return toast.error('Cannot modify main admin via this form.');

    try {
      const res = await axios.post(`${BASE_URL}/api/admin-access/set`, {
        email: newAdminEmail,
        role: newAdminRole,
      }, {
        headers: { 'admin-email': user.email },
      });
      toast.success('Access granted');
      setAccessList(prev => [...prev, res.data.data]);
      setNewAdminEmail('');
      setNewAdminRole('readonly');
    } catch (err) {
      console.error("Error adding admin access:", err);
      toast.error(err.response?.data?.error || 'Failed to add access');
    }
  };

  const handleUpdateRole = async (email, newRole) => {
    if (email === MAIN_ADMIN) return toast.error('Cannot change role of main admin.');
    try {
      await axios.post(`${BASE_URL}/api/admin-access/set`, {
        email,
        role: newRole,
      }, {
        headers: { 'admin-email': user.email },
      });
      toast.success(`Role updated to ${newRole}`);
      setAccessList(prev => prev.map(a => a.email === email ? { ...a, role: newRole } : a));
    } catch (err) {
      console.error("Error updating role:", err);
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDeleteAccess = async (email) => {
    if (email === MAIN_ADMIN) return toast.error('Cannot remove main admin');
    if (!window.confirm(`Are you sure you want to remove access for ${email}?`)) return;

    try {
      await axios.delete(`${BASE_URL}/api/admin-access/${email}`, {
        headers: { 'admin-email': user.email },
      });
      setAccessList(prev => prev.filter(e => e.email !== email));
      toast.success('Access removed successfully');
    } catch (err) {
      console.error("Error deleting access:", err);
      toast.error(err.response?.data?.error || 'Failed to remove access');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await axios.patch(`${BASE_URL}/api/ads/${id}/status`, { status }, {
        headers: { 'admin-email': user.email }
      });
      toast.success(`Ad status updated to ${status}`);
      fetchAds(); // Re-fetch to update the list
    } catch (err) {
      console.error("Error updating ad status:", err);
      toast.error(err.response?.data?.error || 'Failed to update ad status');
    }
  };

  const handleDeleteAd = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ad? This action cannot be undone.`)) return;
    try {
      await axios.delete(`${BASE_URL}/api/ads/${id}`, {
        headers: { 'admin-email': user.email }
      });
      toast.success('Ad deleted successfully!');
      fetchAds(); // Re-fetch to update the list
      if (editAdId === id) { // If the deleted ad was currently being edited
        resetAdForm();
      }
    } catch (err) {
      console.error("Error deleting ad:", err);
      toast.error(err.response?.data?.error || 'Failed to delete ad.');
    }
  };

  // Helper to format UTC date string to IST local time
  const formatIST = (utcDateStr) => {
    if (!utcDateStr) return 'N/A';
    try {
      const date = new Date(utcDateStr);
      // Ensure the date is valid before formatting
      if (isNaN(date.getTime())) {
          return 'Invalid Date';
      }
      return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Invalid Date';
    }
  };

  if (accessDenied) {
    return (
      <div style={{ ...style.container, textAlign: 'center', color: 'red', fontSize: '1.2em', marginTop: '50px' }}>
        🚫 Access Denied. Please ensure you have valid admin credentials.
      </div>
    );
  }

  if (!user || !role) {
    return (
      <div style={{ ...style.container, textAlign: 'center', fontSize: '1.2em', marginTop: '50px' }}>
        🔄 Checking admin access...
      </div>
    );
  }

  return (
    <div style={style.container}>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
      <h2 style={style.heading}>🔐 Admin Panel – Role: {role.toUpperCase()}</h2>

      {role === 'superadmin' && (
        <section style={style.section}>
          <h3 style={{ ...style.heading, borderBottom: 'none' }}>➕ Grant Admin Access</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <input
              type="email"
              placeholder="Admin Email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              style={{ ...style.input, flexGrow: 1 }}
              aria-label="New admin email"
            />
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
              style={{ ...style.select, flexBasis: '150px' }}
              aria-label="New admin role"
            >
              <option value="readonly">Readonly</option>
              <option value="readwrite">Read & Write</option>
            </select>
            <button onClick={handleAddAdminAccess} style={{ ...style.button, flexBasis: '120px' }}>
              Grant Access
            </button>
          </div>

          <h3 style={{ ...style.heading, borderBottom: 'none', marginTop: '30px' }}>📃 Current Access List</h3>
          <div style={{ overflowX: 'auto' }}> {/* Makes table scrollable on small screens */}
            <table style={style.table}>
              <thead>
                <tr>
                  <th style={style.th}>Email</th>
                  <th style={style.th}>Role</th>
                  <th style={style.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accessList.map(entry => (
                  <tr key={entry.email}>
                    <td style={style.td}>{entry.email}</td>
                    <td style={style.td}>
                      <select
                        value={entry.role}
                        onChange={(e) => handleUpdateRole(entry.email, e.target.value)}
                        disabled={entry.email === MAIN_ADMIN}
                        style={style.select}
                        aria-label={`Change role for ${entry.email}`}
                      >
                        <option value="readonly">Readonly</option>
                        <option value="readwrite">Read & Write</option>
                      </select>
                    </td>
                    <td style={style.td}>
                      <button
                        onClick={() => handleDeleteAccess(entry.email)}
                        disabled={entry.email === MAIN_ADMIN}
                        style={{ ...style.button, backgroundColor: '#dc3545' }}
                        aria-label={`Delete access for ${entry.email}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {role !== 'readonly' && (
        <section style={style.section}>
          <h3 style={{ ...style.heading, borderBottom: 'none' }}>
            {editAdId ? '✏️ Edit Ad' : '📢 Create New Ad'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label>Comment (Admin Only):</label>
              <input name="comment" value={newAd.comment} onChange={handleAdChange} style={style.input} />
            </div>
            <div>
              <label>Type: *</label>
              <select name="type" value={newAd.type} onChange={handleAdChange} style={style.select}>
                <option value="banner">Banner</option>
                <option value="popup">Popup</option>
                <option value="card">Card</option>
                <option value="story">Story</option>
              </select>
            </div>
            <div>
              <label>Dimensions: *</label>
              <select name="dimensions" value={newAd.dimensions[0]} onChange={handleAdChange} style={style.select}>
                <option value="16:9">16:9</option>
                <option value="4:5">4:5</option>
                <option value="1:4">1:4</option>
                <option value="1:1">1:1 (Square)</option> {/* Added a common dimension */}
              </select>
            </div>
            <div>
              <label>Content Type: *</label>
              <select name="contentType" value={newAd.contentType} onChange={handleAdChange} style={style.select}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            <div>
              <label>Upload {newAd.contentType}: {editAdId ? '(Leave blank to keep existing)' : '*'}</label>
              <input
                type="file"
                accept={
                  newAd.contentType === 'image'
                    ? 'image/*'
                    : newAd.contentType === 'video'
                      ? 'video/*'
                      : 'audio/*'
                }
                onChange={handleFileChange}
                style={{ ...style.input, paddingTop: '8px' }} // Adjust for file input appearance
              />
              {adPreviewUrl && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  {newAd.contentType === 'image' && (
                    <img src={adPreviewUrl} alt="Ad Preview" style={style.mediaPreview} />
                  )}
                  {newAd.contentType === 'video' && (
                    <video controls src={adPreviewUrl} style={style.mediaPreview} />
                  )}
                  {newAd.contentType === 'audio' && (
                    <audio controls src={adPreviewUrl} style={style.mediaPreview} />
                  )}
                </div>
              )}
            </div>
            <div>
              <label>Start Time (IST): *</label>
              <input type="datetime-local" name="startTime" value={newAd.startTime} onChange={handleAdChange} style={style.input} />
            </div>
            <div>
              <label>End Time (IST): *</label>
              <input type="datetime-local" name="endTime" value={newAd.endTime} onChange={handleAdChange} style={style.input} />
            </div>
            <div>
              <label>Priority: * (Higher number = higher priority)</label>
              <input name="priority" type="number" value={newAd.priority} onChange={handleAdChange} style={style.input} min="1" />
            </div>
            <div>
              <label>Platform: *</label>
              <select name="platform" value={newAd.platform} onChange={handleAdChange} style={style.select}>
                <option value="both">Both</option>
                <option value="web">Web Only</option>
                <option value="mobile">Mobile Only</option>
              </select>
            </div>
            <div>
              <label>Redirect URL:</label>
              <input name="redirectUrl" value={newAd.redirectUrl} onChange={handleAdChange} style={style.input} placeholder="e.g., https://example.com" />
            </div>
            <div>
              <label>CTA Text (Call to Action):</label>
              <input name="ctaText" value={newAd.ctaText} onChange={handleAdChange} style={style.input} placeholder="e.g., Learn More" />
            </div>
            <div>
              <label>Sequence (Order for same priority):</label>
              <input name="sequence" type="number" value={newAd.sequence} onChange={handleAdChange} style={style.input} min="1" />
            </div>
            <div>
              <label>Header (Ad Title):</label>
              <input name="header" value={newAd.header} onChange={handleAdChange} style={style.input} placeholder="e.g., Exciting New Product!" />
            </div>
            <div>
              <label>Summary (Short description):</label>
              <input name="summary" value={newAd.summary} onChange={handleAdChange} style={style.input} placeholder="e.g., Check out our latest offering." />
            </div>
            <div>
              <label>Status: *</label>
              <select name="status" value={newAd.status} onChange={handleAdChange} style={style.select}>
                <option value="active">Active</option>
                <option value="hold">Hold</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button onClick={handleCreateAd} disabled={isSubmitting} style={style.button}>
              {isSubmitting ? 'Submitting...' : editAdId ? '💾 Update Ad' : '➕ Create Ad'}
            </button>
            {editAdId && (
              <button onClick={resetAdForm} style={{ ...style.button, backgroundColor: '#6c757d' }}>
                ❌ Cancel Edit
              </button>
            )}
          </div>
        </section>
      )}

      <section style={style.section}>
        <h3 style={{ ...style.heading, borderBottom: 'none' }}>📃 Active Ads List</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {ads.length === 0 ? (
            <p>No active ads found.</p>
          ) : (
            ads.map((ad) => (
              <div key={ad._id} style={style.adCard}>
                <strong>{ad.header || `Ad ID: ${ad._id.substring(0, 8)}...`}</strong>
                <p>{ad.summary}</p>
                <small>
                  <strong>Type:</strong> {ad.type} | <strong>Content:</strong> {ad.contentType} | <strong>Dimensions:</strong> {ad.dimensions?.join(', ') || 'N/A'}<br />
                  <strong>Platform:</strong> {ad.platform} | <strong>Priority:</strong> {ad.priority} | <strong>Sequence:</strong> {ad.sequence}<br />
                  <strong>Status:</strong> <span style={{ color: ad.status === 'active' ? 'green' : ad.status === 'hold' ? 'orange' : 'red', fontWeight: 'bold' }}>{ad.status}</span><br />
                  ⏰ {formatIST(ad.startTime)} → {formatIST(ad.endTime)}<br />
                  {ad.comment && <em>Comment: {ad.comment}</em>}
                </small>
                {ad.redirectUrl && (
                  <a href={ad.redirectUrl} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', display: 'block', marginTop: '5px' }}>
                    {ad.ctaText || 'Visit Ad'}
                  </a>
                )}
                {(ad.contentBase64 || ad.fileUrl) && ( // Use contentBase64 if available, otherwise fileUrl
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    {ad.contentType === 'image' && <img src={ad.contentBase64 || ad.fileUrl} alt="Ad Content" style={{ maxWidth: '100%', borderRadius: '4px' }} />}
                    {ad.contentType === 'video' && <video controls src={ad.contentBase64 || ad.fileUrl} style={{ maxWidth: '100%', borderRadius: '4px' }} />}
                    {ad.contentType === 'audio' && <audio controls src={ad.contentBase64 || ad.fileUrl} style={{ width: '100%' }} />}
                  </div>
                )}
                {(role === 'readwrite' || role === 'superadmin') && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                    <button onClick={() => handleStatusUpdate(ad._id, 'active')} style={{ ...style.button, backgroundColor: '#28a745', flexGrow: 1 }}>Activate</button>
                    <button onClick={() => handleStatusUpdate(ad._id, 'hold')} style={{ ...style.button, backgroundColor: '#ffc107', flexGrow: 1 }}>Hold</button>
                    <button onClick={() => handleStatusUpdate(ad._id, 'inactive')} style={{ ...style.button, backgroundColor: '#6c757d', flexGrow: 1 }}>Inactivate</button>
                    <button onClick={() => handleDeleteAd(ad._id)} style={{ ...style.button, backgroundColor: '#dc3545', flexGrow: 1 }}>🗑 Delete</button>
                    <button onClick={() => handleEditAd(ad)} style={{ ...style.button, backgroundColor: '#007bff', flexGrow: 1 }}>✏️ Edit</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>


      <section style={style.section}>
        <h3 style={{ ...style.heading, borderBottom: 'none' }}>🧩 Configure Field Visibility</h3>
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '20px' }}>Loading Field Configurations...</div>}>
          {blocks.length === 0 ? (
            <p>No block fields to configure.</p>
          ) : (
            blocks.map((block) => (
              <div key={block.blockId} style={{ border: '1px solid #e0e0e0', padding: '15px', marginBottom: '20px', borderRadius: '8px', backgroundColor: '#fdfdfd' }}>
                <h4 style={{ color: '#555', borderBottom: '1px dashed #e0e0e0', paddingBottom: '10px', marginBottom: '15px' }}>{block.blockName}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                  {block.fields.map((field) => (
                    // React.memo is applied inside FieldConfigEditor if it's a functional component
                    // Otherwise, ensure it's performant on its own
                    <FieldConfigEditor
                      key={field.fieldKey}
                      blockId={block.blockId}
                      config={field}
                      email={user.email}
                      readonly={role === 'readonly'}
                      // You might want to pass a callback to refresh blocks if an update occurs
                      // onUpdate={fetchAllBlockFields} // Example if FieldConfigEditor updates state in parent
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </Suspense>
      </section>
    </div>
  );
};

export default AdminPanel;
