// components/Layout.js
import React, { useState } from 'react';
import AppSidebar from './AppSidebar';
import { Button } from 'react-bootstrap';
import { List } from 'react-bootstrap-icons';

const Layout = ({ children }) => {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="d-flex">
      {showSidebar && (
        <AppSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
        />
      )}

      <div style={{ maarginLeft: showSidebar ? '260px' : '20px', flex: 1}}>
        {!showSidebar && (
          <Button
            variant="light"
            onClick={() => setShowSidebar(true)}
            className="position-fixed"
            style={{
              zIndex: 1100,
              color: "black",
              left: "10px",
              top: "10px",
              backgroundColor: "white",
              borderRadius: "8px",
              padding:'8px',
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
            }}
          >
            <List size={22} />
          </Button>
        )}

        <div className="p-3" style={{marginLeft:"30px"}}>{children}</div>
      </div>
    </div>
  );
};

export default Layout;
