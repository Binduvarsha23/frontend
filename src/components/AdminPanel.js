import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import FieldConfigEditor from './FieldConfigEditor'; // Adjust if path differs

const BASE_URL = 'https://backend-pbmi.onrender.com';
const ADMIN_EMAIL = 'binduvarshasunkara@gmail.com';

const AdminPanel = () => {
  const [user, setUser] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [accessDenied, setAccessDenied] = useState(false);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u?.email !== ADMIN_EMAIL) {
        setAccessDenied(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch blocks and fields when user is confirmed
  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) {
      fetchAllBlockFields(user.email);
    }
  }, [user]);

  const fetchAllBlockFields = async (email) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/admin-field-config/all-blocks-fields`, {
        headers: { 'admin-email': email },
      });
      setBlocks(res.data);
    } catch (err) {
      console.error('Error loading admin fields:', err.message);
    }
  };

  if (accessDenied) {
    return <div style={{ padding: 20, color: 'red' }}>🚫 Access Denied. Admins only.</div>;
  }

  if (!user) {
    return <div style={{ padding: 20 }}>🔄 Checking admin access...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
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
