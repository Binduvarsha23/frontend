import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react'; // or replace with emoji if needed
import { toast } from 'react-toastify'; // ✅ Optional: if using react-toastify
import 'react-toastify/dist/ReactToastify.css';

const BASE_URL = 'https://backend-pbmi.onrender.com';

const FieldConfigEditor = ({ blockId, config, email }) => {
  const [required, setRequired] = useState(config.required);
  const [visible, setVisible] = useState(config.visible);

  const toggleRequired = async () => {
    const newVal = !required;
    setRequired(newVal);
    await saveConfig({ required: newVal });
  };

  const toggleVisible = async () => {
    const newVal = !visible;
    setVisible(newVal);
    await saveConfig({ visible: newVal });
  };

  const saveConfig = async (updates) => {
    try {
      await axios.post(`${BASE_URL}/api/admin-field-config/save`, {
        blockId,
        fieldKey: config.fieldKey,
        label: config.label,
        required,
        visible,
        ...updates,
      }, {
        headers: { 'admin-email': email },
      });
      toast.success(`Saved "${config.fieldKey}" settings`, { autoClose: 1500 });
    } catch (err) {
      console.error('Save error:', err.message);
      toast.error(`Failed to save "${config.fieldKey}"`, { autoClose: 2000 });
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #ddd', padding: '5px 0'
    }}>
      <div style={{ flex: 1 }}>{config.fieldKey}</div>

      <label>
        <input
          type="checkbox"
          checked={required}
          onChange={toggleRequired}
        /> Required
      </label>

      <span style={{ cursor: 'pointer', paddingLeft: 10 }} onClick={toggleVisible}>
        {visible ? <Eye size={20} /> : <EyeOff size={20} />}
      </span>
    </div>
  );
};

export default FieldConfigEditor;
