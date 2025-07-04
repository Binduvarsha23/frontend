import React, { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Button } from 'react-bootstrap';
import { List } from 'react-bootstrap-icons';

const Layout = ({ children }) => {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setShowSidebar(!mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && showSidebar) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isMobile, showSidebar]);

  return (
    <div className="d-flex" style={{ overflowX: "hidden", position: "relative" }}>
      {showSidebar && (
        <>
          <AppSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
          />
          {isMobile && (
            <div
              className="position-fixed top-0 start-0 w-100 h-100"
              style={{ zIndex: 1040, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
              onClick={() => setShowSidebar(false)}
            />
          )}
        </>
      )}

      <div
        style={{
          marginLeft: !isMobile && showSidebar ? "260px" : "0",
          transition: "margin-left 0.3s ease",
          width: "100%",
          maxWidth: "100vw",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        {!showSidebar && isMobile && (
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
              padding: '8px',
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
            }}
          >
            <List size={22} />
          </Button>
        )}

        <div className="p-3" style={{ minHeight: '100vh', paddingRight: '16px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
