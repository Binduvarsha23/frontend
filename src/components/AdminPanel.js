import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import FieldConfigEditor from './FieldConfigEditor';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BASE_URL = 'https://backend-pbmi.onrender.com';
const ADMIN_EMAIL = 'socioclubsc@gmail.com';

const AdminPanel = () => {
  const [user, setUser] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [ads, setAds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adBase64, setAdBase64] = useState('');
  const [adBase64File, setAdBase64File] = useState(null);
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
    userOptions: [],
    status: 'active',
    comment: '' // NEW
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u?.email !== ADMIN_EMAIL) {
        setAccessDenied(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) {
      fetchAllBlockFields(user.email);
      fetchAds();
    }
  }, [user]);

  const fetchAllBlockFields = async (email) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/admin-field-config/all-blocks-fields`, {
        headers: { 'admin-email': email },
      });
      setBlocks(res.data);
    } catch {
      toast.error('Failed to load block fields');
    }
  };

  const fetchAds = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/ads/admin/all`);
      const now = new Date();
      const filtered = res.data.filter(ad => new Date(ad.endTime) > now);
      setAds(filtered);
    } catch (err) {
      console.error("❌ Error fetching ads:", err);
      toast.error('Error fetching ads');
    }
  };

  const handleAdChange = (e) => {
    const { name, value } = e.target;
    setNewAd((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileToBase64 = (file) => {
    setAdBase64File(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAdBase64(reader.result);
    };
    if (file) reader.readAsDataURL(file);
  };

  const handleCreateAd = async () => {
    setIsSubmitting(true);
    try {
      if (!adBase64File) {
        toast.error('Please upload a valid file');
        setIsSubmitting(false);
        return;
      }

      if (new Date(newAd.endTime) <= new Date(newAd.startTime)) {
        toast.error('End time must be after start time');
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('type', newAd.type);
      formData.append('dimensions', newAd.dimensions[0]);
      formData.append('contentType', newAd.contentType);
      formData.append('startTime', newAd.startTime);
      formData.append('endTime', newAd.endTime);
      formData.append('priority', newAd.priority);
      formData.append('platform', newAd.platform);
      formData.append('redirectUrl', newAd.redirectUrl);
      formData.append('ctaText', newAd.ctaText);
      formData.append('sequence', newAd.sequence);
      formData.append('header', newAd.header);
      formData.append('summary', newAd.summary);
      formData.append('userOptions', JSON.stringify([]));
      formData.append('status', newAd.status);
      formData.append('comment', newAd.comment);
      formData.append('image', adBase64File);

      await axios.post(`${BASE_URL}/api/ads`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Ad created!');
      fetchAds();
      setNewAd({
        type: 'banner', dimensions: ['16:9'], contentType: 'image', startTime: '', endTime: '',
        priority: 1, platform: 'both', redirectUrl: '', ctaText: '', sequence: 1,
        header: '', summary: '', userOptions: [], status: 'active', comment: ''
      });
      setAdBase64('');
      setAdBase64File(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create ad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleHide = async (id) => {
    await axios.patch(`${BASE_URL}/api/ads/${id}/hide`);
    fetchAds();
  };

  const handleStatusChange = async (id, newStatus) => {
  try {
    const ad = ads.find((a) => a._id === id);
    if (!ad) return;

    // Delete the old ad
    await axios.delete(`${BASE_URL}/api/ads/${id}`);

    // Rebuild form data
    const formData = new FormData();

    for (const [key, value] of Object.entries(ad)) {
      if (['_id', '__v', 'contentBase64', 'createdAt', 'updatedAt'].includes(key)) continue;
      if (key === 'userOptions') {
        formData.append(key, JSON.stringify(value));
      } else if (typeof value === 'object' && value instanceof Date) {
        formData.append(key, new Date(value).toISOString());
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        formData.append(key, value.toString());
      } else {
        formData.append(key, value ?? '');
      }
    }

    // Override with updated status and optional comment
    formData.set('status', newStatus);
    formData.set('comment', ad.comment || '');

    // Fetch the base64 blob again
    if (!ad.contentBase64) {
      toast.error('Missing ad contentBase64, cannot recreate ad.');
      return;
    }
    const blob = await fetch(ad.contentBase64).then((r) => r.blob());
    formData.append('image', blob);

    // Recreate ad
    await axios.post(`${BASE_URL}/api/ads`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    toast.success(`Ad updated to ${newStatus}`);
    fetchAds();
  } catch (err) {
    console.error('Failed to update status:', err.response || err);
    toast.error(err.response?.data?.error || 'Failed to update status');
  }
};

  const handleDeleteAd = async (id) => {
    if (window.confirm('Are you sure you want to delete this ad?')) {
      await axios.delete(`${BASE_URL}/api/ads/${id}`);
      fetchAds();
    }
  };

  const formatIST = (utcDateStr) => {
    const date = new Date(utcDateStr);
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  if (accessDenied) return <div style={{ padding: 20, color: 'red' }}>🚫 Access Denied. Admins only.</div>;
  if (!user) return <div style={{ padding: 20 }}>🔄 Checking admin access...</div>;

  return (
    <div style={{ padding: 20 }}>
      <ToastContainer />
      <div style={{ marginTop: 40 }}>
        <h2>📢 Manage Internal Ads</h2>
        <label>Comment (Admin Only):</label>
        <input name="comment" value={newAd.comment} onChange={handleAdChange} /><br />

        <label>Type: *</label>
          <select name="type" value={newAd.type} onChange={handleAdChange}>
            <option value="banner">Banner</option>
            <option value="popup">Popup</option>
            <option value="card">Card</option>
            <option value="story">Story</option>
          </select><br />

          <label>Dimensions: *</label>
          <select name="dimensions" value={newAd.dimensions[0]} onChange={handleAdChange}>
            <option value="16:9">16:9</option>
            <option value="4:5">4:5</option>
            <option value="1:4">1:4</option>
          </select><br />

          <label>Content Type: *</label>
          <select name="contentType" value={newAd.contentType} onChange={handleAdChange}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select><br />

          <label>Upload {newAd.contentType}: *</label>
          <input
            type="file"
            accept={
              newAd.contentType === 'image'
                ? 'image/*'
                : newAd.contentType === 'video'
                  ? 'video/*'
                  : 'audio/*'
            }
            onChange={(e) => handleFileToBase64(e.target.files[0])}
          /><br />

          {adBase64 && newAd.contentType === 'image' && (
            <img src={adBase64} alt="Preview" style={{ width: 200, marginTop: 10 }} />
          )}
          {adBase64 && newAd.contentType === 'video' && (
            <video controls width={300} src={adBase64} style={{ marginTop: 10 }} />
          )}
          {adBase64 && newAd.contentType === 'audio' && (
            <audio controls src={adBase64} style={{ marginTop: 10 }} />
          )}

          <label>Start Time (IST): *</label>
          <input type="datetime-local" name="startTime" value={newAd.startTime} onChange={handleAdChange} /><br />

          <label>End Time (IST): *</label>
          <input type="datetime-local" name="endTime" value={newAd.endTime} onChange={handleAdChange} /><br />

          <label>Priority: *</label>
          <input name="priority" type="number" value={newAd.priority} onChange={handleAdChange} /><br />

          <label>Platform: *</label>
          <select name="platform" value={newAd.platform} onChange={handleAdChange}>
            <option value="both">Both</option>
            <option value="web">Web Only</option>
            <option value="mobile">Mobile Only</option>
          </select><br />

          <label>Redirect URL:</label>
          <input name="redirectUrl" value={newAd.redirectUrl} onChange={handleAdChange} /><br />

          <label>CTA Text:</label>
          <input name="ctaText" value={newAd.ctaText} onChange={handleAdChange} /><br />

          <label>Sequence:</label>
          <input name="sequence" type="number" value={newAd.sequence} onChange={handleAdChange} /><br />

          <label>Header:</label>
          <input name="header" value={newAd.header} onChange={handleAdChange} /><br />

          <label>Summary:</label>
          <input name="summary" value={newAd.summary} onChange={handleAdChange} /><br />

          <label>Status: *</label>
          <select name="status" value={newAd.status} onChange={handleAdChange}>
            <option value="active">Active</option>
            <option value="hold">Hold</option>
            <option value="inactive">Inactive</option>
          </select><br />

        <button onClick={handleCreateAd} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : '➕ Create Ad'}
        </button>
      </div>

      <div>
        <h3>📃 Existing Ads</h3>
        {ads.length === 0 && <p>No ads to display.</p>}
        {ads.map((ad) => (
          <div key={ad._id} style={{ border: '1px solid #eee', marginBottom: 10, padding: 10 }}>
            <b>{ad.header || ad.type}:</b> {ad.summary}<br />
            <i>📝 Comment: {ad.comment}</i>
            <div style={{ fontSize: '0.85em', color: '#555' }}>
              ⏱ {formatIST(ad.startTime)} → {formatIST(ad.endTime)}<br />
              📺 Platform: {ad.platform} | Priority: {ad.priority} | Hidden: {ad.isHidden ? 'Yes' : 'No'} | Status: {ad.status}
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => handleToggleHide(ad._id)}>
                {ad.isHidden ? 'Unhide' : 'Hide'}
              </button>
              <button onClick={() => handleStatusChange(ad._id, 'hold')} style={{ marginLeft: 10 }}>
                Hold
              </button>
              <button onClick={() => handleStatusChange(ad._id, 'active')} style={{ marginLeft: 10 }}>
                Activate
              </button>
              <button onClick={() => handleStatusChange(ad._id, 'inactive')} style={{ marginLeft: 10 }}>
                Inactivate
              </button>
              <button onClick={() => handleDeleteAd(ad._id)} style={{ marginLeft: 10, color: 'red' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2>Admin Panel – Configure Fields</h2>
      {blocks.map((block) => (
        <div key={block.blockId} style={{ border: '1px solid #ccc', marginBottom: 20, padding: 10 }}>
          <h3>{block.blockName}</h3>
          {block.fields.map((field) => (
            <FieldConfigEditor
              key={field.fieldKey}
              blockId={block.blockId}
              config={field}
              email={user.email}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;
