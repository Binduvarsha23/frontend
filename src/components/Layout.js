// File: components/Layout.js
import React, { useEffect, useState } from 'react';
import AppSidebar from './AppSidebar';
import { Button } from 'react-bootstrap';
import { List } from 'react-bootstrap-icons';

const Layout = ({ children }) => {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setShowSidebar(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showHamburger = !showSidebar;

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

      {/* Main Content */}
      <div
        className="flex-grow-1"
        style={{
          marginLeft: showSidebar && !isMobile ? '260px' : '0',
          paddingLeft: showHamburger ? '45px' : '0px', // Shift down when 3-bar shows
          transition: 'margin-left 0.3s ease, padding-top 0.3s ease',
          width: '100%',
        }}
      >
        {/* 3-bar toggle button */}
        {showHamburger && (
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
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
          >
            <List size={22} />
          </Button>
        )}

        {/* Page Content */}
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
