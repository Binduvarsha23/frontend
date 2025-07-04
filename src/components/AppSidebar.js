// File: AppSidebar.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HouseDoorFill, PeopleFill, LockFill,
  CloudUploadFill, CalculatorFill, ShieldLockFill,
  BoxArrowRight, Search
} from 'react-bootstrap-icons';
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import { onAuthStateChanged } from 'firebase/auth';
import debounce from 'lodash.debounce';

const AppSidebar = ({ activeTab, setActiveTab, showSidebar, setShowSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsub();
  }, []);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <HouseDoorFill /> },
    { id: "family", label: "Family Tree", icon: <PeopleFill /> },
    { id: "health", label: "health", icon: <ShieldLockFill /> },
    { id: "passwords", label: "Passwords", icon: <LockFill /> },
    { id: "documents", label: "Documents", icon: <CloudUploadFill /> },
    { id: "wealth", label: "Wealth", icon: <CalculatorFill /> },
    { id: "security", label: "Security", icon: <ShieldLockFill /> },
  ];

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (window.innerWidth < 768) setShowSidebar(false);
    if (id === "documents") navigate("/dashboard");
    else if (id === "dashboard") navigate("/app/dashboard");
    else navigate(`/app/${id}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const fetchSearchResults = useCallback(debounce(async (query) => {
    if (!userId || !query) return;
    try {
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/search?userId=${userId}&query=${encodeURIComponent(query)}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Live search error:', err);
    }
  }, 500), [userId]);

  useEffect(() => {
    if (searchText.trim()) fetchSearchResults(searchText);
    else setSearchResults([]);
  }, [searchText, fetchSearchResults]);

  const handleSuggestionSelect = (item) => {
    navigate('/app/search-page', { state: { results: [item], query: searchText } });
    setSearchText('');
    setSearchResults([]);
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const handleSearch = () => {
    navigate('/app/search-page', { state: { results: searchResults, query: searchText } });
    setSearchText('');
    setSearchResults([]);
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="bg-black text-white d-flex flex-column position-fixed top-0 start-0" style={{ width: '260px', height: '100vh', zIndex: 1050, overflowY: 'auto' }}>
      <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0 fw-bold">WEALTH VAULT</h5>
          <small>Secure • Stable • Smart</small>
        </div>
        <button className="btn btn-sm btn-outline-light px-2 py-0" onClick={() => setShowSidebar(false)}>✕</button>
      </div>

      <div className="p-3 border-bottom border-secondary">
        <div className="input-group">
          <input
            type="text"
            className="form-control form-control-sm bg-dark text-white border-secondary"
            placeholder="Search anything..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyPress}
          />
          <button className="btn btn-outline-secondary" onClick={handleSearch}>
            <Search size={16} />
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="bg-dark text-white border border-secondary mt-1 rounded" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-2 border-bottom border-secondary hover-bg-light"
                style={{ cursor: 'pointer' }}
                onClick={() => handleSuggestionSelect(item)}
              >
                {(item.blockName || item.assetName || item.investmentName || item.nomineeName || item.name || item?.data?.website)} - {item.type}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-grow-1 p-3 overflow-auto">
        {menuItems.map((item) => {
          let route = item.id === "documents" ? "/dashboard" : `/app/${item.id}`;
          const isActive = location.pathname === route;
          return (
            <button
              key={item.id}
              className={`btn w-100 text-start d-flex align-items-center gap-3 mb-2 py-2 px-3 rounded ${isActive ? 'btn-light text-dark' : 'btn-outline-secondary text-white'}`}
              onClick={() => handleTabClick(item.id)}
            >
              {item.icon}<span className="fw-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-top border-secondary">
        <button className="btn btn-outline-secondary w-100 text-start d-flex align-items-center gap-3 py-2 px-3 text-white" onClick={handleLogout}>
          <BoxArrowRight size={18} />
          <span>Lock Vault</span>
        </button>
        <div className="text-center mt-3">
          <span className="badge bg-dark border border-secondary text-secondary">AES-256 Encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default AppSidebar;
