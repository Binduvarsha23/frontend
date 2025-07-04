import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Badge } from 'react-bootstrap';

const SearchPage = () => {
  const location = useLocation();
  const results = location.state?.results || [];

  const renderFields = (obj) => {
    if (!obj) return null;
    return Object.entries(obj).map(([key, value], idx) => (
      <div key={idx} className="mb-1">
        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
      </div>
    ));
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return '';
    }
  };

  if (results.length === 0) {
    return <div className="p-4"><h4>❌ No results found</h4></div>;
  }

  return (
    <div className="p-4">
      <h3>🔍 Search Results </h3>
      <div className="row mt-4">
        {results.map((item, index) => (
          <div className="col-md-6 col-lg-4 mb-4" key={index}>
            <Card className="shadow border-dark">
              <Card.Body>
                <Card.Title className="d-flex justify-content-between align-items-center">
                  {item.blockName || item.assetName || item.investmentName || item.nomineeName || item.name || "Untitled"}
                  <Badge bg="secondary">{item.type}</Badge>
                </Card.Title>

                <Card.Subtitle className="mb-2 text-muted">
                  {item.category || item.location || item.data?.website || ""}
                </Card.Subtitle>

                <Card.Text>
                  {item.createdAt && (
                    <div className="mb-2 text-muted">
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                  )}

                  {/* Render form data */}
                  {item.data && renderFields(item.data)}

                  {/* Render nominee fields */}
                  {item.nomineeName && (
                    <div className="mt-2">
                      <div><strong>Nominee:</strong> {item.nomineeName}</div>
                      <div><strong>Relation:</strong> {item.nomineeRelation}</div>
                      <div><strong>Share:</strong> {item.percentage}%</div>
                    </div>
                  )}

                  {/* Render family member if available */}
                  {item.family && (
                    <div className="mt-2">
                      <div className="fw-bold text-primary">Family Member</div>
                      {renderFields(item.family)}
                    </div>
                  )}
                </Card.Text>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;
