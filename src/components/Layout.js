// File: components/Layout.js
import React, { useEffect, useState } from 'react';
import AppSidebar from './AppSidebar';
import { Button } from 'react-bootstrap';
import { List } from 'react-bootstrap-icons';

const Layout = ({ children }) => {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Optional: adjust sidebar on screen resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="d-flex">
      {/* Sidebar */}
      {showSidebar && (
        <AppSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
        />
      )}

      {/* Main content area */}
      <div
        className="flex-grow-1"
        style={{
          marginLeft: showSidebar && window.innerWidth > 768 ? '260px' : '0',
          transition: 'margin-left 0.3s ease',
          width: '100%',
        }}
      >
        {/* 3-bar toggle for mobile */}
        {!showSidebar && (
          <Button
            variant="light"
            onClick={() => setShowSidebar(true)}
            className="position-fixed"
            style={{
              zIndex: 1100,
              left: '10px',
              top: '10px',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '8px',
              marginRight:'30px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
          >
            <List size={22} />
          </Button>
        )}

        {/* Content */}
        <div className="p-3" style={{ paddingTop: '20px' }}>{children}</div>
      </div>
    </div>
  );
};

export default Layout;
