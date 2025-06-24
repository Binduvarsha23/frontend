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

      <div style={{ marginLeft: showSidebar ? '260px' : '0', flex: 1 }}>
        {!showSidebar && (
          <Button
            variant="link"
            onClick={() => setShowSidebar(true)}
            className="m-2 position-fixed"
            style={{ zIndex: 1100 , color:"black", paddingLeft:"10px"}}
          >
            <List size={26} />
          </Button>
        )}

        <div className="p-3">{children}</div>
      </div>
    </div>
  );
};

export default Layout;