import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { FaEdit, FaTrashAlt, FaPlusCircle, FaRegSave, FaSpinner } // Added FaSpinner for loading
from "react-icons/fa";
import {
  FaFileInvoice,
  FaChartLine,
  FaHouse,
  FaCar,
  FaGem,
  FaChartPie,
  FaChartSimple,
  FaLocationDot,
  FaUser,
  FaUpRightFromSquare,
  FaCoins,
  FaMoneyBillWave,
  FaListOl,
} from "react-icons/fa6";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import "./WealthDashboard.css"; // Import the new CSS file
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const WealthDashboard = () => {
  const [assets, setAssets] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [editing, setEditing] = useState({ type: null, data: null });
  const [activeTab, setActiveTab] = useState("assets");
  const [loading, setLoading] = useState(true); 
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null); 
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      setUserId(user.uid);
    } else {
      setUserId(null);
    }
  });
  return () => unsubscribe();
}, []);

 const fetchData = async () => {
  if (!userId) return;
  setLoading(true);
  setError(null);
  try {
    const [assetsRes, investmentsRes] = await Promise.all([
      axios.get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`),
      axios.get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`),
    ]);
    setAssets(assetsRes.data);
    setInvestments(investmentsRes.data);
  } catch (err) {
    console.error("Error fetching data:", err);
    setError("Failed to load data. Please try again later.");
  } finally {
    setLoading(false);
  }
};


 useEffect(() => {
  if (userId) {
    fetchData();
  }
}, [userId]);


 const addAsset = async (asset) => {
  try {
    const res = await axios.post("https://backend-pbmi.onrender.com/api/assets", {
      ...asset,
      userId,
    });
    setAssets([...assets, res.data]);
  } catch (err) {
    console.error("Error adding asset:", err);
    setError("Failed to add asset.");
  }
};


  const updateAsset = async (id, updatedAsset) => {
    try {
      const res = await axios.put(`https://backend-pbmi.onrender.com/api/assets/${id}`, updatedAsset);
      setAssets(assets.map((a) => (a._id === id ? res.data : a)));
      setEditing({ type: null, data: null }); // Clear editing state after update
    } catch (err) {
      console.error("Error updating asset:", err);
      setError("Failed to update asset.");
    }
  };

  const deleteAsset = async (id) => {
    if (window.confirm("Are you sure you want to delete this asset?")) {
      try {
        await axios.delete(`https://backend-pbmi.onrender.com/api/assets/${id}`);
        setAssets(assets.filter((a) => a._id !== id));
      } catch (err) {
        console.error("Error deleting asset:", err);
        setError("Failed to delete asset.");
      }
    }
  };

 const addInvestment = async (investment) => {
  try {
    const res = await axios.post("https://backend-pbmi.onrender.com/api/investments", {
      ...investment,
      userId,
    });
    setInvestments([...investments, res.data]);
  } catch (err) {
    console.error("Error adding investment:", err);
    setError("Failed to add investment.");
  }
};

  const updateInvestment = async (id, updatedInvestment) => {
    try {
      const res = await axios.put(`https://backend-pbmi.onrender.com/api/investments/${id}`, updatedInvestment);
      setInvestments(investments.map((i) => (i._id === id ? res.data : i)));
      setEditing({ type: null, data: null }); // Clear editing state after update
    } catch (err) {
      console.error("Error updating investment:", err);
      setError("Failed to update investment.");
    }
  };

  const deleteInvestment = async (id) => {
    if (window.confirm("Are you sure you want to delete this investment?")) {
      try {
        await axios.delete(`https://backend-pbmi.onrender.com/api/investments/${id}`);
        setInvestments(investments.filter((i) => i._id !== id));
      } catch (err) {
        console.error("Error deleting investment:", err);
        setError("Failed to delete investment.");
      }
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculateReturnPercentage = (invested, current) => {
    const numInvested = Number(invested);
    const numCurrent = Number(current);

    if (isNaN(numInvested) || isNaN(numCurrent) || numInvested === 0) {
      return "N/A";
    }

    const profit = numCurrent - numInvested;
    const percentage = (profit / numInvested) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  const totalAssetsValue = assets.reduce((sum, a) => sum + Number(a.value || 0), 0); // Handle potential undefined/null
  const totalInvested = investments.reduce((sum, i) => sum + Number(i.investedAmount || 0), 0);
  const totalInvestmentValue = investments.reduce((sum, i) => sum + Number(i.currentValue || 0), 0);

  const groupedAssets = useMemo(() => {
    const groups = {};
    assets.forEach((asset) => {
      const type = asset.type || 'Other'; // Default to 'Other' if type is missing
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(asset);
    });
    return groups;
  }, [assets]);

  const getInvestmentIcon = (type) => {
    switch (type) {
      case "Stocks":
        return <FaChartSimple className="investment-icon-blue" aria-label="Stocks" />;
      case "Mutual Funds":
        return <FaChartPie className="investment-icon-green" aria-label="Mutual Funds" />;
      case "Digital Gold":
        return <FaCoins className="investment-icon-orange" aria-label="Digital Gold" />;
      case "Fixed Deposit":
        return <FaMoneyBillWave className="investment-icon-red" aria-label="Fixed Deposit" />;
      default:
        return <FaChartLine className="investment-icon-grey" aria-label="Investment" />;
    }
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case "Real Estate":
        return <FaHouse aria-label="Real Estate" />;
      case "Vehicle":
        return <FaCar aria-label="Vehicle" />;
      case "Luxury Items":
        return <FaGem aria-label="Luxury Items" />;
      default:
        return <FaListOl aria-label="Other Asset" />;
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <FaSpinner className="spin" size={50} aria-label="Loading data..." />
        <p>Loading your wealth data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message alert alert-danger text-center" role="alert">
        {error}
        <button className="btn btn-primary mt-3" onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <>
    <div className="container py-4 wealth-dashboard-container">
      <h2 className="mb-4 text-center section-title">
        <FaChartLine className="title-icon" aria-hidden="true" /> Wealth Overview
      </h2>

      {/* Summary Cards */}
      <div className="row text-center g-3 mb-5 summary-cards">
        <div className="col-6 col-md-3">
          <div className="summary-card bg-info">
            <h6>Total Assets Value</h6>
            <p className="mb-0">{formatCurrency(totalAssetsValue)}</p>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="summary-card bg-success">
            <h6>Total Investment Value</h6>
            <p className="mb-0">{formatCurrency(totalInvestmentValue)}</p>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="summary-card bg-warning">
            <h6>Amount Invested</h6>
            <p className="mb-0">{formatCurrency(totalInvested)}</p>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="summary-card bg-secondary">
            <h6>Total Entries</h6>
            <p className="mb-0">
              {assets.length + investments.length} ({assets.length} assets &{" "}
              {investments.length} investments)
            </p>
          </div>
        </div>
      </div>

      {/* Tabs for Assets and Investments */}
      <div className="mb-4 d-flex justify-content-center tab-buttons" role="tablist">
        <button
          className={`btn ${activeTab === "assets" ? "btn-dark" : "btn-outline-dark"}`}
          onClick={() => setActiveTab("assets")}
          role="tab"
          aria-selected={activeTab === "assets"}
          id="assets-tab"
          aria-controls="assets-panel"
        >
          <FaHouse className="me-2" aria-hidden="true" /> Assets
        </button>
        <button
          className={`btn ${activeTab === "investments" ? "btn-dark" : "btn-outline-dark"}`}
          onClick={() => setActiveTab("investments")}
          role="tab"
          aria-selected={activeTab === "investments"}
          id="investments-tab"
          aria-controls="investments-panel"
        >
          <FaChartLine className="me-2" aria-hidden="true" /> Investments
        </button>
      </div>

      {/* Asset Management Section */}
      <div
        className="tab-content"
        id="wealth-dashboard-tab-content"
      >
        {activeTab === "assets" && (
          <div
            className="tab-pane fade show active"
            id="assets-panel"
            role="tabpanel"
            aria-labelledby="assets-tab"
            tabIndex="0"
          >
            <div className="row g-4">
              <div className="col-md-5">
                <div className="p-4 border rounded form-card shadow-sm">
                  <h5 className="form-card-title">
                    {editing.type === "asset" ? "Edit Asset" : "Add New Asset"}
                  </h5>
                  <Form
                    type="asset"
                    onSubmit={editing.type === "asset" ? (data) => updateAsset(editing.data._id, data) : addAsset}
                    initial={editing.type === "asset" ? editing.data : null}
                    onCancelEdit={() => setEditing({ type: null, data: null })}
                  />
                </div>
              </div>

              <div className="col-md-7">
                <div className="section-card">
                  <div className="section-header">
                    <FaFileInvoice aria-hidden="true" />
                    <h2>Assets by Category</h2>
                  </div>
                  <p className="section-description">Manage your physical and digital assets</p>

                  {Object.keys(groupedAssets).length === 0 ? (
                    <p className="empty-state-message text-center text-muted mt-4">
                      No assets added yet. Use the form on the left to add your first asset!
                    </p>
                  ) : (
                    Object.entries(groupedAssets).map(([category, items]) => (
                      <div className="asset-category" key={category}>
                        <div className="category-header">
                          {getAssetIcon(category)}
                          <h3>{category}</h3>
                          <span className={`item-count item-count-${category.replace(/\s/g, '-').toLowerCase()}`}>
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {items.map((a) => (
                          <div key={a._id} className="asset-item" tabIndex="0"> {/* Make items focusable */}
                            <div className="asset-details">
                              <h4>{a.name}</h4>
                              {a.description && <p className="asset-type">{a.description}</p>}
                              {a.location && (
                                <p className="asset-location">
                                  <FaLocationDot aria-hidden="true" /> {a.location}{" "}
                                  <a href="#" className="icon-small-link" aria-label={`View ${a.name} location`}>
                                    <FaUpRightFromSquare className="icon-small" aria-hidden="true" />
                                  </a>
                                </p>
                              )}
                              <p className="asset-nominee">
                                <FaUser aria-hidden="true" /> Nominee: {a.nominee}
                              </p>
                            </div>
                            <div className="asset-value-wrapper">
                              <span className="asset-value" aria-label={`Value: ${formatCurrency(a.value)}`}>
                                {formatCurrency(a.value)}
                              </span>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-outline-primary action-btn"
                                  onClick={() => setEditing({ type: "asset", data: a })}
                                  title="Edit Asset"
                                  aria-label={`Edit ${a.name}`}
                                >
                                  <FaEdit aria-hidden="true" />
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger action-btn"
                                  onClick={() => deleteAsset(a._id)}
                                  title="Delete Asset"
                                  aria-label={`Delete ${a.name}`}
                                >
                                  <FaTrashAlt aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investment Management Section */}
        {activeTab === "investments" && (
          <div
            className="tab-pane fade show active"
            id="investments-panel"
            role="tabpanel"
            aria-labelledby="investments-tab"
            tabIndex="0"
          >
            <div className="row g-4">
              <div className="col-md-5">
                <div className="p-4 border rounded form-card shadow-sm">
                  <h5 className="form-card-title">
                    {editing.type === "investment" ? "Edit Investment" : "Add New Investment"}
                  </h5>
                  <Form
                    type="investment"
                    onSubmit={editing.type === "investment" ? (data) => updateInvestment(editing.data._id, data) : addInvestment}
                    initial={editing.type === "investment" ? editing.data : null}
                    onCancelEdit={() => setEditing({ type: null, data: null })}
                  />
                </div>
              </div>

              <div className="col-md-7">
                <div className="section-card">
                  <div className="section-header">
                    <FaChartLine aria-hidden="true" />
                    <h2>Investment Portfolio</h2>
                  </div>
                  <p className="section-description">Track your financial investments and returns</p>

                  {investments.length === 0 ? (
                    <p className="empty-state-message text-center text-muted mt-4">
                      No investments added yet. Start by adding your first investment!
                    </p>
                  ) : (
                    investments.map((i) => {
                      const returnPercentage = calculateReturnPercentage(i.investedAmount, i.currentValue);
                      const isPositiveReturn = Number(i.currentValue || 0) >= Number(i.investedAmount || 0);

                      return (
                        <div className="investment-item" key={i._id} tabIndex="0"> {/* Make items focusable */}
                          <div className="investment-details">
                            <div className="investment-icon-wrapper">
                              {getInvestmentIcon(i.type)}
                            </div>
                            <div>
                              <h4>{i.name}</h4>
                              <p className="investment-type">{i.type}</p>
                              <p className="investment-nominee">
                                <FaUser aria-hidden="true" /> Nominee: {i.nominee}
                              </p>
                            </div>
                          </div>
                          <div className="investment-value-details">
                            <div className="investment-current-value" aria-label={`Current Value: ${formatCurrency(i.currentValue)}`}>
                              {formatCurrency(i.currentValue)}
                            </div>
                            <p className="investment-invested" aria-label={`Invested Amount: ${formatCurrency(i.investedAmount)}`}>
                              Invested: {formatCurrency(i.investedAmount)}
                            </p>
                            <p className={`investment-return ${isPositiveReturn ? "investment-return-positive" : "investment-return-negative"}`}
                               aria-label={`Return: ${returnPercentage}`}
                            >
                              {returnPercentage}
                            </p>
                            <div className="action-buttons">
                              <button
                                className="btn btn-sm btn-outline-primary action-btn"
                                onClick={() => setEditing({ type: "investment", data: i })}
                                title="Edit Investment"
                                aria-label={`Edit ${i.name}`}
                              >
                                <FaEdit aria-hidden="true" />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger action-btn"
                                onClick={() => deleteInvestment(i._id)}
                                title="Delete Investment"
                                aria-label={`Delete ${i.name}`}
                              >
                                <FaTrashAlt aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div> {/* End of tab-content */}
    </div>
  );
};

const Form = ({ type, onSubmit, initial, onCancelEdit }) => {
  const defaultState = useMemo(() => {
    return type === "asset"
      ? { name: "", type: "", value: "", location: "", nominee: "", description: "" }
      : { name: "", type: "", investedAmount: "", currentValue: "", nominee: "" };
  }, [type]);

  const [form, setForm] = useState(initial || defaultState);

  useEffect(() => {
    setForm(initial || defaultState);
  }, [initial, defaultState]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

 const handleSubmit = (e) => {
  e.preventDefault();

  // Common validation
  const isNegative = (val) => Number(val) < 0;

  if (type === "asset") {
    if (isNegative(form.value)) {
      toast.error("Asset value cannot be negative.");
      return;
    }
  } else if (type === "investment") {
    if (isNegative(form.investedAmount)) {
      toast.error("Invested amount cannot be negative.");
      return;
    }
    if (isNegative(form.currentValue)) {
      toast.error("Current value cannot be negative.");
      return;
    }
  }

  onSubmit(form);
};


  const typeOptions = {
    asset: ["Real Estate", "Vehicle", "Luxury Items", "Other"],
    investment: ["Stocks", "Mutual Funds", "Digital Gold", "Fixed Deposit", "Other"],
  };

  return (
    <form onSubmit={handleSubmit} aria-label={`${initial ? 'Edit' : 'Add New'} ${type === 'asset' ? 'Asset' : 'Investment'} Form`}>
      <div className="mb-3">
        <label htmlFor={`${type}-name`} className="form-label">
          {type === "asset" ? "Asset Name" : "Investment Name"} <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          className="form-control"
          id={`${type}-name`}
          name="name"
          value={form.name}
          placeholder={type === "asset" ? "e.g., Primary Residence, Honda City" : "e.g., HDFC Equity Fund, TCS Shares"}
          onChange={handleChange}
          required
          aria-required="true"
        />
      </div>

      <div className="mb-3">
        <label htmlFor={`${type}-type`} className="form-label">Type <span className="text-danger">*</span></label>
        <select
          className="form-select"
          id={`${type}-type`}
          name="type"
          value={form.type}
          onChange={handleChange}
          required
          aria-required="true"
        >
          <option value="">Select Type</option>
          {typeOptions[type].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {type === "asset" ? (
        <>
          <div className="mb-3">
            <label htmlFor="asset-value" className="form-label">Value (₹) <span className="text-danger">*</span></label>
            <input
              type="number"
              className="form-control"
              id="asset-value"
              name="value"
              value={form.value}
              placeholder="0"
              onChange={handleChange}
              required
              aria-required="true"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="asset-location" className="form-label">Location</label>
            <input
              type="text"
              className="form-control"
              id="asset-location"
              name="location"
              value={form.location}
              placeholder="City, State"
              onChange={handleChange}
            />
          </div>

          <div className="mb-3">
            <label htmlFor="asset-description" className="form-label">Description</label>
            <input
              type="text"
              className="form-control"
              id="asset-description"
              name="description"
              value={form.description}
              placeholder="Brief description (e.g., 3BHK Apartment, 2022 Model)"
              onChange={handleChange}
            />
          </div>
        </>
      ) : (
        <>
          <div className="mb-3">
            <label htmlFor="investment-invested" className="form-label">Amount Invested (₹) <span className="text-danger">*</span></label>
            <input
              type="number"
              className="form-control"
              id="investment-invested"
              name="investedAmount"
              value={form.investedAmount}
              placeholder="0"
              onChange={handleChange}
              required
              aria-required="true"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="investment-current" className="form-label">Current Value (₹) <span className="text-danger">*</span></label>
            <input
              type="number"
              className="form-control"
              id="investment-current"
              name="currentValue"
              value={form.currentValue}
              placeholder="0"
              onChange={handleChange}
              required
              aria-required="true"
            />
          </div>
        </>
      )}

      <div className="mb-3">
        <label htmlFor={`${type}-nominee`} className="form-label">Nominee <span className="text-danger">*</span></label>
        <input
          type="text"
          className="form-control"
          id={`${type}-nominee`}
          name="nominee"
          value={form.nominee}
          placeholder="e.g., Jane Doe, Alex Doe"
          onChange={handleChange}
          required
          aria-required="true"
        />
      </div>

      <div className="d-flex justify-content-between flex-wrap gap-2"> {/* flex-wrap and gap for mobile */}
        <button type="submit" className="btn btn-primary flex-grow-1">
          {initial ? <><FaRegSave className="me-2" aria-hidden="true" /> Update</> : <><FaPlusCircle className="me-2" aria-hidden="true" /> Add</>}{" "}
          {type === "asset" ? "Asset" : "Investment"}
        </button>
        {initial && (
          <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={onCancelEdit}>
            Cancel Edit
          </button>
        )}
      </div>
    </form>
  <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
        </>
);
};

export default WealthDashboard;
