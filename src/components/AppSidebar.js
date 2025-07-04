import React from 'react';
import {
  HouseDoorFill, PeopleFill, LockFill,
  CloudUploadFill, CalculatorFill, ShieldLockFill,
  BoxArrowRight
} from 'react-bootstrap-icons';
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useLocation, useNavigate } from "react-router-dom";

const AppSidebar = ({ activeTab, setActiveTab, showSidebar, setShowSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <HouseDoorFill /> },
    { id: "family", label: "Family Tree", icon: <PeopleFill /> },
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

  return (
    <div
      className="bg-black text-white d-flex flex-column position-fixed top-0 start-0"
      style={{
  width: '260px',
  height: '100vh',
  minHeight: '100vh',
  zIndex: 1050,
  backgroundColor: 'black',
  position: 'fixed',
  top: 0,
  left: 0,
  overflowY: 'auto',
}}

    >
      {/* Header */}
      <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0 fw-bold">WEALTH VAULT</h5>
          <small className="text-white">Secure • Stable • Smart</small>
        </div>
        <button
          className="btn btn-sm btn-outline-light px-2 py-0"
          style={{ fontSize: '1rem' }}
          onClick={() => setShowSidebar(false)}
        >
          ✕
        </button>
      </div>

      {/* Menu */}
      <div className="flex-grow-1 p-3 overflow-auto">
        {menuItems.map((item) => {
          let route = item.id === "documents" ? "/dashboard" : `/app/${item.id}`;
          const isActive = location.pathname === route;

          return (
            <button
              key={item.id}
              className={`btn w-100 text-start d-flex align-items-center gap-3 mb-2 py-2 px-3 rounded ${
                isActive ? 'btn-light text-dark' : 'btn-outline-secondary text-white'
              }`}
              onClick={() => handleTabClick(item.id)}
            >
              {item.icon}
              <span className="fw-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-top border-secondary">
        <button
          className="btn btn-outline-secondary w-100 text-start d-flex align-items-center gap-3 py-2 px-3 text-white"
          onClick={handleLogout}
        >
          <BoxArrowRight size={18} />
          <span>Lock Vault</span>
        </button>
        <div className="text-center mt-3">
          <span className="badge bg-dark border border-secondary text-secondary">
            AES-256 Encrypted
          </span>
        </div>
      </div>
    </div>
  );
};

export default AppSidebar;
