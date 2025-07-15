import React, { useState, useEffect, useCallback } from 'react';
import {
  HouseDoorFill, PeopleFill, LockFill,
  CloudUploadFill, CalculatorFill, ShieldLockFill,
  BoxArrowRight, Search
} from 'react-bootstrap-icons';
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; // Assuming firebase.js provides 'auth'
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
    // Listen for Firebase authentication state changes
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid); // Set user ID if authenticated
      } else {
        setUserId(null); // Clear user ID if not authenticated
      }
    });
    return () => unsub(); // Unsubscribe on component unmount
  }, []);

  // Define the menu items for the sidebar
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <HouseDoorFill /> },
    { id: "family", label: "Family Tree", icon: <PeopleFill /> },
    { id: "health", label: "Health", icon: <ShieldLockFill /> },
    { id: "passwords", label: "Passwords", icon: <LockFill /> },
    { id: "documents", label: "Documents", icon: <CloudUploadFill /> },
    { id: "wealth", label: "Wealth", icon: <CalculatorFill /> },
    { id: "security", label: "Security", icon: <ShieldLockFill /> },
    // Moved Lock Vault here to be part of the main menu items
    { id: "logout", label: "Lock Vault", icon: <BoxArrowRight size={18} />, isLogout: true },
  ];

  // Handler for clicking on a sidebar tab
  const handleTabClick = (id) => {
    setActiveTab(id); // Set the active tab
    // Close sidebar on mobile after clicking a tab for better UX
    if (window.innerWidth < 768) setShowSidebar(false);
    // Navigate to the corresponding route
    // Note: The "documents" route `/dashboard` seems inconsistent with others `/app/${id}`.
    // Ensure your routing setup handles this correctly.
    if (id === "documents") navigate("/dashboard");
    else if (id === "dashboard") navigate("/app/dashboard");
    else navigate(`/app/${id}`);
  };

  // Handler for logging out the user
  const handleLogout = async () => {
    await signOut(auth); // Sign out from Firebase
    navigate("/"); // Redirect to the home/login page
    // Close sidebar on mobile after logout
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  // Debounced function to fetch search results from the backend
  const fetchSearchResults = useCallback(debounce(async (query) => {
    if (!userId || !query) {
      setSearchResults([]); // Clear results if user ID or query is empty
      return;
    }
    try {
      // Make an API call to your backend search endpoint
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/search?userId=${userId}&query=${encodeURIComponent(query)}`);
      setSearchResults(res.data); // Update search results state
    } catch (err) {
      console.error('Live search error:', err);
      setSearchResults([]); // Clear results on error to prevent displaying stale data
    }
  }, 500), [userId]); // Re-create debounced function if userId changes

  useEffect(() => {
    // Trigger search when searchText changes, with a debounce
    if (searchText.trim()) {
      fetchSearchResults(searchText);
    } else {
      setSearchResults([]); // Clear results immediately if search text is empty
    }
  }, [searchText, fetchSearchResults]); // Dependencies for this effect

  // Handler for selecting a search suggestion
  const handleSuggestionSelect = (item) => {
    // Navigate to a dedicated search results page with the selected item
    navigate('/app/search-page', { state: { results: [item], query: searchText } });
    setSearchText(''); // Clear search text after selection
    setSearchResults([]); // Clear search results after selection
    if (window.innerWidth < 768) setShowSidebar(false); // Close sidebar on mobile
  };

  // Handler for performing a full search (e.g., on Enter key or search button click)
  const handleSearch = () => {
    // Navigate to a dedicated search results page with all current search results
    navigate('/app/search-page', { state: { results: searchResults, query: searchText } });
    setSearchText(''); // Clear search text after search
    setSearchResults([]); // Clear search results after search
    if (window.innerWidth < 768) setShowSidebar(false); // Close sidebar on mobile
  };

  // Handler for key presses in the search input, specifically for 'Enter'
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent default form submission behavior
      handleSearch(); // Trigger the search
    }
  };

  return (
    <>
      {/* Overlay for mobile sidebar: Appears when sidebar is shown on small screens */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)} // Click on overlay to close sidebar
        ></div>
      )}

      {/* Sidebar Container:
          - Fixed position on mobile, slides in/out using 'left' property.
          - On medium screens and up, it will always be visible with 'left: 0'.
          - Uses original Bootstrap-like classes for general styling.
      */}
      <div
        className="bg-black text-white d-flex flex-column position-fixed top-0"
        style={{
          width: '260px',
          height: '100vh',
          zIndex: 1050,
          overflowY: 'auto',
          left: showSidebar ? '0' : '-260px', // Control visibility with left property
          transition: 'left 0.3s ease-in-out', // Smooth transition
        }}
      >
        {/* Header Section */}
        <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0 fw-bold">WEALTH VAULT</h5>
            <small>Secure • Stable • Smart</small>
          </div>
          {/* Close button for mobile: Only visible on small screens */}
          <button className="btn btn-sm btn-outline-light px-2 py-0 d-md-none" onClick={() => setShowSidebar(false)}>✕</button>
        </div>

        {/* Search Section */}
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
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="bg-dark text-white border border-secondary mt-1 rounded" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 border-bottom border-secondary hover-bg-light"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSuggestionSelect(item)}
                >
                  {/* Display relevant item name based on its type */}
                  {(item.blockName || item.assetName || item.investmentName || item.nomineeName || item.name || item?.data?.website)} - {item.type}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menu Items Section */}
        <div className="flex-grow-1 p-3 overflow-auto"> {/* Allows menu items to scroll if too many */}
          {menuItems.map((item) => {
            // Determine the route or action for each menu item
            if (item.isLogout) {
              return (
                <button
                  key={item.id}
                  className="btn w-100 text-start d-flex align-items-center gap-3 py-2 px-3 text-white btn-outline-secondary rounded"
                  onClick={handleLogout}
                >
                  {item.icon}<span className="fw-medium">{item.label}</span>
                </button>
              );
            } else {
              let route = item.id === "documents" ? "/dashboard" : `/app/${item.id}`;
              const isActive = location.pathname === route; // Check if the current path matches the item's route
              return (
                <button
                  key={item.id}
                  className={`btn w-100 text-start d-flex align-items-center gap-3 mb-2 py-2 px-3 rounded
                    ${isActive ? 'btn-light text-dark' : 'btn-outline-secondary text-white'}`}
                  onClick={() => handleTabClick(item.id)}
                >
                  {item.icon}<span className="fw-medium">{item.label}</span>
                </button>
              );
            }
          })}
          {/* AES-256 Encrypted badge moved here, below the menu items */}
          <div className="text-center mt-3">
            <span className="badge bg-dark border border-secondary text-secondary">AES-256 Encrypted</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default AppSidebar;
