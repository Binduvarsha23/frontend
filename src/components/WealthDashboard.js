import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { FaEdit, FaTrashAlt, FaPlusCircle, FaRegSave, FaSpinner } from "react-icons/fa";
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
import { FaHeart, FaRegHeart } from 'react-icons/fa';

// Helper functions for localStorage caching
const getCachedData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error reading from localStorage", e);
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Error writing to localStorage", e);
  }
};

const WealthDashboard = () => {
  const [assets, setAssets] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [editing, setEditing] = useState({ type: null, data: null });
  const [activeTab, setActiveTab] = useState("assets");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [nominees, setNominees] = useState([]); // This will store ALL nominee records

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setAssets([]);
        setInvestments([]);
        setNominees([]);
        localStorage.removeItem('cachedAssets');
        localStorage.removeItem('cachedInvestments');
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async (isBackgroundFetch = false) => {
    if (!userId) {
      if (isInitialLoad) setLoading(false);
      return;
    }

    if (!isBackgroundFetch) {
      const cachedAssets = getCachedData(`cachedAssets_${userId}`);
      const cachedInvestments = getCachedData(`cachedInvestments_${userId}`);
      if (cachedAssets || cachedInvestments) {
        if (cachedAssets) setAssets(cachedAssets);
        if (cachedInvestments) setInvestments(cachedInvestments);
        setLoading(false);
        setIsInitialLoad(false);
      } else {
        setLoading(true);
      }
    }

    setError(null);
    try {
      const [assetsRes, investmentsRes, familyRes, nomineesRes] = await Promise.all([
        axios.get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`),
        axios.get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`),
        axios.get(`https://backend-pbmi.onrender.com/api/family?userId=${userId}`), // Assuming family members from localhost
        axios.get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`), // Fetch ALL nominees
      ]);

      const fetchedAssets = assetsRes.data;
      const fetchedInvestments = investmentsRes.data;
      const fetchedNominees = nomineesRes.data;

      // Attach nominees to their respective assets/investments
      const assetsWithNominees = fetchedAssets.map(asset => ({
        ...asset,
        nominees: fetchedNominees.filter(n => n.itemId === asset._id && n.type === 'asset')
      }));

      const investmentsWithNominees = fetchedInvestments.map(investment => ({
        ...investment,
        nominees: fetchedNominees.filter(n => n.itemId === investment._id && n.type === 'investment')
      }));

      setAssets(assetsWithNominees);
      setInvestments(investmentsWithNominees);
      setFamilyMembers(familyRes.data);
      setNominees(fetchedNominees); // Keep all raw nominees in state too for easier access

      setCachedData(`cachedAssets_${userId}`, assetsWithNominees);
      setCachedData(`cachedInvestments_${userId}`, investmentsWithNominees);

      if (isBackgroundFetch) {
        toast.success("Data updated in the background!", { autoClose: 1500 });
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data. Please try again later.");
      if (!getCachedData(`cachedAssets_${userId}`) && !getCachedData(`cachedInvestments_${userId}`)) {
        setLoading(false);
      }
    } finally {
      if (!isBackgroundFetch) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [userId, isInitialLoad]);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, fetchData]);


  const saveNominees = async (itemType, itemId, currentNominees) => {
    const hasAnyNomineeData = currentNominees.some(n => n.name || n.percentage > 0);
    const totalPercentage = currentNominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);

    // Only validation, no toast
    if (hasAnyNomineeData && totalPercentage > 100) {
      throw new Error("Nominee percentage exceeds 100%");
    }

    const validNomineesToSave = currentNominees.filter(n =>
      n.name && n.nomineeId && n.percentage >= 0
    );

    // Delete old nominees first
    const existingNomineesForItem = nominees.filter(n => n.itemId === itemId && n.type === itemType);
    await Promise.all(existingNomineesForItem.map(async (n) => {
      try {
        await axios.delete(`https://backend-pbmi.onrender.com/api/nominees/${n._id}`);
      } catch (delErr) {
        console.error(`Failed to delete nominee ${n._id}:`, delErr);
      }
    }));

    // Add new nominees
    await Promise.all(validNomineesToSave.map(async (nominee) => {
      try {
        await axios.post("https://backend-pbmi.onrender.com/api/nominees", {
          userId,
          type: itemType,
          itemId,
          percentage: nominee.percentage,
          nomineeId: nominee.nomineeId,
          nomineeName: nominee.name,
        });
      } catch (addErr) {
        console.error(`Failed to add nominee for ${itemType} ${itemId}:`, addErr);
        throw addErr;
      }
    }));
  };


  const addAsset = async (assetData) => {
    const { nominees: assetNominees, ...restOfAssetData } = assetData;
    const tempId = `temp-${Date.now()}`; // Temporary ID for optimistic update

    // Create a temporary asset object, including its nominees
    const newAssetOptimistic = {
      ...restOfAssetData,
      _id: tempId,
      userId,
      nominees: assetNominees.map(n => ({ ...n, itemId: tempId, type: 'asset' })), // Link nominees to tempId
      createdAt: new Date().toISOString(), // Add a timestamp for consistent display
      favorite: false, // Default favorite status
    };

    // Optimistically add the new asset to the state
    setAssets(prevAssets => [...prevAssets, newAssetOptimistic]);
    // Optimistically add nominees to the global nominees state
    setNominees(prevNominees => [...prevNominees, ...newAssetOptimistic.nominees]);
    toast.info("Adding asset..."); // Immediate feedback

    try {
      const formData = new FormData();
      for (const key in restOfAssetData) {
        if (key === 'imageFile' && restOfAssetData[key]) {
          formData.append('image', restOfAssetData[key]);
        } else if (key !== 'imageUrl') {
          formData.append(key, restOfAssetData[key]);
        }
      }
      formData.append('userId', userId);

      const res = await axios.post("https://backend-pbmi.onrender.com/api/assets", formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const actualNewAsset = res.data; // This will have the real _id

      // Update assets state: replace optimistic asset with actual asset
      setAssets(prevAssets => prevAssets.map(a => a._id === tempId ? {
        ...actualNewAsset,
        nominees: actualNewAsset.nominees || assetNominees.map(n => ({ ...n, itemId: actualNewAsset._id, type: 'asset' })) // Ensure nominees are correctly linked
      } : a));

      // Update nominees state: link optimistic nominees to the actual asset ID
      setNominees(prevNominees => prevNominees.map(n =>
        n.itemId === tempId ? { ...n, itemId: actualNewAsset._id } : n
      ));

      // Save nominees to backend (now that we have the real newAsset._id)
      await saveNominees('asset', actualNewAsset._id, assetNominees);

      setEditing({ type: null, data: null });
      toast.success("Asset added successfully!");
    } catch (err) {
      console.error("Error adding asset:", err);
      // Rollback optimistic update
      setAssets(prevAssets => prevAssets.filter(a => a._id !== tempId));
      setNominees(prevNominees => prevNominees.filter(n => n.itemId !== tempId));

      if (err.response?.status === 409) {
        const { name, type: assetType } = assetData;
        const existing = assets.find(a => a.name === name && a.type === assetType);
        if (existing) {
          setEditing({ type: "asset", data: existing });
          toast.error(err.response.data.error);
        }
      } else {
        toast.error("Failed to add asset.");
      }
    }
  };


  const updateAsset = async (id, updatedAssetData) => {
    const { nominees: assetNominees, ...restOfAssetData } = updatedAssetData; // Separate nominees
    try {
      const formData = new FormData();
      for (const key in restOfAssetData) {
        if (key === 'imageFile' && restOfAssetData[key]) {
          formData.append('image', restOfAssetData[key]);
        } else if (key === 'imageUrl' && restOfAssetData[key] === null) {
          formData.append(key, '');
        } else if (key !== 'imageFile') {
          formData.append(key, restOfAssetData[key]);
        }
      }
      formData.append('userId', userId);

      const res = await axios.put(`https://backend-pbmi.onrender.com/api/assets/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const updatedAsset = res.data;

      await saveNominees('asset', updatedAsset._id, assetNominees); // Update nominees

      setEditing({ type: null, data: null });
      toast.success("Asset updated successfully!");
      fetchData(false); // Re-fetch all data to update dashboard
    } catch (err) {
      console.error("Error updating asset:", err);
      toast.error("Failed to update asset or its nominees.");
    }
  };

  const deleteAsset = async (id) => {
    const originalAssets = assets; // Store original state for rollback
    const originalNominees = nominees; // Store original nominees for rollback

    // Optimistic UI update: immediately filter out the deleted asset and its nominees
    setAssets(prevAssets => prevAssets.filter(a => a._id !== id));
    setNominees(prevNominees => prevNominees.filter(n => n.itemId !== id || n.type !== 'asset'));
    toast.success("Deleting asset..."); // Immediate feedback

    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/assets/${id}`);
      // Nominees are handled by backend cascade or will be filtered out by fetchData
      toast.success("Asset and associated nominees deleted successfully!");
      fetchData(false); // Re-fetch all data to ensure consistency
    } catch (err) {
      console.error("Error deleting asset:", err);
      toast.error("Failed to delete asset. Rolling back...");
      setAssets(originalAssets); // Rollback if deletion fails
      setNominees(originalNominees); // Rollback nominees
    }
  };

  const addInvestment = async (investmentData) => {
    const { nominees: investmentNominees, ...restOfInvestmentData } = investmentData;
    const tempId = `temp-${Date.now()}`; // Temporary ID for optimistic update

    // Create a temporary investment object, including its nominees
    const newInvestmentOptimistic = {
      ...restOfInvestmentData,
      _id: tempId,
      userId,
      nominees: investmentNominees.map(n => ({ ...n, itemId: tempId, type: 'investment' })), // Link nominees to tempId
      createdAt: new Date().toISOString(), // Add a timestamp for consistent display
      favorite: false, // Default favorite status
    };

    // Optimistically add the new investment to the state
    setInvestments(prevInvestments => [...prevInvestments, newInvestmentOptimistic]);
    // Optimistically add nominees to the global nominees state
    setNominees(prevNominees => [...prevNominees, ...newInvestmentOptimistic.nominees]);
    toast.info("Adding investment..."); // Immediate feedback

    try {
      const res = await axios.post("https://backend-pbmi.onrender.com/api/investments", {
        ...restOfInvestmentData,
        userId,
      });
      const actualNewInvestment = res.data; // This will have the real _id

      // Update investments state: replace optimistic investment with actual investment
      setInvestments(prevInvestments => prevInvestments.map(i => i._id === tempId ? {
        ...actualNewInvestment,
        nominees: actualNewInvestment.nominees || investmentNominees.map(n => ({ ...n, itemId: actualNewInvestment._id, type: 'investment' })) // Ensure nominees are correctly linked
      } : i));

      // Update nominees state: link optimistic nominees to the actual investment ID
      setNominees(prevNominees => prevNominees.map(n =>
        n.itemId === tempId ? { ...n, itemId: actualNewInvestment._id } : n
      ));

      // Save nominees to backend (now that we have the real newInvestment._id)
      await saveNominees('investment', actualNewInvestment._id, investmentNominees);

      setEditing({ type: null, data: null });
      toast.success("Investment added successfully!");
    } catch (err) {
      console.error("Error adding investment:", err);
      // Rollback optimistic update
      setInvestments(prevInvestments => prevInvestments.filter(i => i._id !== tempId));
      setNominees(prevNominees => prevNominees.filter(n => n.itemId !== tempId));

      toast.error("Failed to add investment.");
    }
  };

  const updateInvestment = async (id, updatedInvestmentData) => {
    const { nominees: investmentNominees, ...restOfInvestmentData } = updatedInvestmentData; // Separate nominees
    try {
      const res = await axios.put(`https://backend-pbmi.onrender.com/api/investments/${id}`, restOfInvestmentData);
      const updatedInvestment = res.data;

      await saveNominees('investment', updatedInvestment._id, investmentNominees); // Update nominees

      setEditing({ type: null, data: null });
      toast.success("Investment updated successfully!");
      fetchData(false);
    } catch (err) {
      console.error("Error updating investment:", err);
      toast.error("Failed to update investment or its nominees.");
    }
  };

  const deleteInvestment = async (id) => {
    const originalInvestments = investments; // Store original state for rollback
    const originalNominees = nominees; // Store original nominees for rollback

    // Optimistic UI update: immediately filter out the deleted investment and its nominees
    setInvestments(prevInvestments => prevInvestments.filter(i => i._id !== id));
    setNominees(prevNominees => prevNominees.filter(n => n.itemId !== id || n.type !== 'investment'));
    toast.success("Deleting investment..."); // Immediate feedback

    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/investments/${id}`);
      // Nominees are handled by backend cascade or will be filtered out by fetchData
      toast.success("Investment and associated nominees deleted successfully!");
      fetchData(false); // Re-fetch all data to ensure consistency
    } catch (err) {
      console.error("Error deleting investment:", err);
      toast.error("Failed to delete investment. Rolling back...");
      setInvestments(originalInvestments); // Rollback if deletion fails
      setNominees(originalNominees); // Rollback nominees
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

  // Memoized values will now correctly reflect nominees fetched and attached
  const totalAssetsValue = useMemo(() => assets.reduce((sum, a) => sum + Number(a.value || 0), 0), [assets]);
  const totalInvested = useMemo(() => investments.reduce((sum, i) => sum + Number(i.investedAmount || 0), 0), [investments]);
  const totalInvestmentValue = useMemo(() => investments.reduce((sum, i) => sum + Number(i.currentValue || 0), 0), [investments]);

  const groupedAssets = useMemo(() => {
    const groups = {};
    assets.forEach((asset) => {
      const type = asset.type || 'Other';
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

  if (loading && assets.length === 0 && investments.length === 0) {
    return (
      <div className="loading-spinner">
        <FaSpinner className="spin" size={50} aria-label="Loading data..." />
        <p>Loading your wealth data...</p>
      </div>
    );
  }

  if (error && assets.length === 0 && investments.length === 0) {
    return (
      <div className="error-message alert alert-danger text-center" role="alert">
        {error}
        <button className="btn btn-primary mt-3" onClick={() => fetchData(false)}>Retry</button>
      </div>
    );
  }

  const toggleFavorite = (id, type) => {
  const updateState = (setFn, list) => {
    setFn(list.map((item) =>
      item._id === id ? { ...item, favorite: !item.favorite } : item
    ));
  };

  if (type === 'asset') updateState(setAssets, assets);
  if (type === 'investment') updateState(setInvestments, investments);

  axios
    .patch(`https://backend-pbmi.onrender.com/api/${type}s/${id}/favorite`)
    .then(() => {
      toast.success(`${type} favorite updated`);
    })
    .catch((err) => {
      toast.error(`Failed to update favorite for ${type}`);
      console.error("Favorite toggle error:", err);

      // Revert on failure
      if (type === 'asset') updateState(setAssets, assets);
      if (type === 'investment') updateState(setInvestments, investments);
    });
};
  

  return (
    <div className="container py-4 wealth-dashboard-container">
      <h2 className="mb-4 text-center section-title">
        <FaChartLine className="title-icon" aria-hidden="true" /> Wealth Overview
      </h2>

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

      <div className="tab-content" id="wealth-dashboard-tab-content">
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
                    familyMembers={familyMembers}
                    nominees={nominees} // Still pass all nominees for potential lookup if needed
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
                          <div key={a._id} className="asset-item" tabIndex="0">
                            <div className="asset-details">
                              <h4>{a.name}</h4>
                              {a.description && <p className="asset-type">{a.description}</p>}
                              {/* Display image if imageUrl exists */}
                              {a.imageUrl && (
                                <div className="asset-image-container mb-2">
                                  <img src={a.imageUrl} alt={a.name} className="img-fluid rounded" style={{ maxWidth: '100%', height: 'auto' }} />
                                </div>
                              )}
                              {a.location && (
                                <p className="asset-location">
                                  <FaLocationDot aria-hidden="true" /> {a.location}{" "}
                                  <a href="#" className="icon-small-link" aria-label={`View ${a.name} location`}>
                                    <FaUpRightFromSquare className="icon-small" aria-hidden="true" />
                                  </a>
                                </p>
                              )}
                              {a.nominees && a.nominees.length > 0 && (
                                <div className="nominee-list">
                                  <h6>Nominees:</h6>
                                  {a.nominees.map((n) => (
                                    <p key={n._id} className="asset-nominee">
                                      <FaUser aria-hidden="true" /> {n.nomineeName} ({n.percentage}%)
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="asset-value-wrapper">
                              <span className="asset-value" aria-label={`Value: ${formatCurrency(a.value)}`}>
                                {formatCurrency(a.value)}
                              </span>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-outline-danger action-btn"
                                  onClick={() => toggleFavorite(a._id, 'asset')}
                                  title={a.favorite ? "Unmark Favorite" : "Mark Favorite"}
                                  aria-label={a.favorite ? `Unmark ${a.name} as favorite` : `Mark ${a.name} as favorite`}
                                >
                                  {a.favorite ? <FaHeart /> : <FaRegHeart />}
                                </button>
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
                    familyMembers={familyMembers}
                    nominees={nominees}
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
                        <div className="investment-item" key={i._id} tabIndex="0">
                          <div className="investment-details">
                            <div className="investment-icon-wrapper">
                              {getInvestmentIcon(i.type)}
                            </div>
                            <div>
                              <h4>{i.name}</h4>
                              <p className="investment-type">{i.type}</p>
                              {i.nominees && i.nominees.length > 0 && (
                                <div className="nominee-list">
                                  <h6>Nominees:</h6>
                                  {i.nominees.map((n) => (
                                    <p key={n._id} className="investment-nominee">
                                      <FaUser aria-hidden="true" /> {n.nomineeName} ({n.percentage}%)
                                    </p>
                                  ))}
                                </div>
                              )}
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
                                className="btn btn-sm btn-outline-danger action-btn"
                                onClick={() => toggleFavorite(i._id, 'investment')}
                                title={i.favorite ? "Unmark Favorite" : "Mark Favorite"}
                                aria-label={i.favorite ? `Unmark ${i.name} as favorite` : `Mark ${i.name} as favorite`}
                              >
                                {i.favorite ? <FaHeart /> : <FaRegHeart />}
                              </button>
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
        </div>
      </div>
    );
  };

  const Form = ({ type, onSubmit, initial, onCancelEdit, familyMembers }) => {
    const defaultState = useMemo(() => {
      // Ensure defaultState correctly resets all fields including image related ones
      return type === "asset"
        ? { name: "", type: "", value: "", location: "", description: "", imageUrl: "", imageFile: null, nominees: [{ name: "", percentage: 0, nomineeId: "" }] }
        : { name: "", type: "", investedAmount: "", currentValue: "", nominees: [{ name: "", percentage: 0, nomineeId: "" }] };
    }, [type]);

    const [form, setForm] = useState(initial || defaultState);

    // When initial data changes (e.g., for editing OR clearing form after submission), reset form state
    useEffect(() => {
      if (initial) {
        // Map initial nominees to include nomineeId (which comes from backend Nominee model)
        const initialNominees = initial.nominees && initial.nominees.length > 0
          ? initial.nominees.map(n => ({
            name: n.nomineeName, // Use nomineeName from fetched data
            percentage: n.percentage,
            nomineeId: n.nomineeId // This is the _id of the Family member
          }))
          : [{ name: "", percentage: 0, nomineeId: "" }];

        setForm({
          ...initial,
          imageFile: null, // Always clear imageFile when switching to edit mode
          imageUrl: initial.imageUrl || "", // Use existing imageUrl or empty string
          nominees: initialNominees,
        });
      } else {
        setForm(defaultState); // Reset to default (empty) state
      }
    }, [initial, defaultState]);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setForm((prev) => ({ ...prev, imageFile: file, imageUrl: URL.createObjectURL(file) }));
      } else {
        setForm((prev) => ({ ...prev, imageFile: null, imageUrl: "" }));
      }
    };

    const handleRemoveImage = () => {
      setForm((prev) => ({ ...prev, imageFile: null, imageUrl: "" }));
    };

    const addNominee = () => {
      // Prevent adding if nominee with same name already exists
      const existingNames = form.nominees.map(n => n.name);
      if (existingNames.includes("") || existingNames.length >= familyMembers.length) {
        toast.error("Please fill all existing nominee entries or no more unique nominees available.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        nominees: [...prev.nominees, { name: "", percentage: 0, nomineeId: "" }],
      }));
    };

    const handleNomineeChange = (index, field, value) => {
    setForm((prev) => {
      const newNominees = [...prev.nominees];

      if (field === "nomineeId") {
        const selectedMember = familyMembers.find((f) => f._id === value);
        if (!selectedMember) return prev;

        // Prevent duplicate nominee selection
        const alreadySelected = newNominees.some((n, i) => n.nomineeId === value && i !== index);
        if (alreadySelected) {
          toast.error("This nominee is already added.");
          return prev;
        }

        newNominees[index].nomineeId = selectedMember._id;
        newNominees[index].name = selectedMember.fullName;
      }

      if (field === "percentage") {
        newNominees[index].percentage = Number(value);
      }

      return { ...prev, nominees: newNominees };
    });
  };

    const removeNominee = (index) => {
      setForm((prev) => {
        const newNominees = prev.nominees.filter((_, i) => i !== index);
        // If all nominees are removed, ensure at least one empty nominee field remains for UX
        if (newNominees.length === 0) {
          return { ...prev, nominees: [{ name: "", percentage: 0, nomineeId: "" }] };
        }
        return { ...prev, nominees: newNominees };
      });
    };

    const handleSubmit = (e) => {
      e.preventDefault();

      const isNegative = (val) => Number(val) < 0;
      const totalPercentage = form.nominees.reduce((sum, n) => sum + (n.percentage || 0), 0);
      const hasAnyNomineeName = form.nominees.some(n => n.name);

      // Validation for required fields for asset/investment
      if (type === "asset") {
        if (!form.name || !form.type || form.value === "") {
          toast.error("Please fill in all required fields for asset (Name, Type, Value).");
          return;
        }
        if (isNegative(form.value)) {
          toast.error("Asset value cannot be negative.");
          return;
        }
      } else if (type === "investment") {
        if (!form.name || !form.type || form.investedAmount === "" || form.currentValue === "") {
          toast.error("Please fill in all required fields for investment (Name, Type, Invested, Current Value).");
          return;
        }
        if (isNegative(form.investedAmount)) {
          toast.error("Invested amount cannot be negative.");
          return;
        }
        if (isNegative(form.currentValue)) {
          toast.error("Current value cannot be negative.");
          return;
        }
      }

      // Nominee specific validations
      if (hasAnyNomineeName || form.nominees.some(n => n.percentage > 0)) {
        if (totalPercentage > 100) {
          // No toast here anymore
          return;
        }


        const invalidNominee = form.nominees.some(n =>
          n.name.trim() === "" ||
          n.percentage < 0 ||
          (!n.name && n.percentage > 0)
        );

        if (invalidNominee) {
          toast.error("Ensure all entered nominees have a valid name selected from the list and a non-negative percentage. Remove empty nominee rows if not needed.");
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
      <>
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

              {/* Field for Image Upload */}
              <div className="mb-3">
                <label htmlFor="asset-image-upload" className="form-label">Upload Image (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  id="asset-image-upload"
                  name="imageFile" // Name for the file input
                  accept="image/*" // Accept only image files
                  onChange={handleImageChange}
                />
                <small className="form-text text-muted">Select an image file (e.g., JPG, PNG).</small>

                {/* Display current image or preview of new image */}
                {(form.imageUrl || initial?.imageUrl) && (
                  <div className="mt-3 image-preview-container">
                    <p className="mb-2">Current Image:</p>
                    <img
                      src={form.imageUrl || initial?.imageUrl}
                      alt="Asset"
                      className="img-thumbnail"
                      style={{ maxWidth: '200px', maxHeight: '200px' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/200x200/cccccc/000000?text=Image+Error"; }}
                    />
                    <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={handleRemoveImage}>Remove Image</button>
                  </div>
                )}
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

          <div className="mb-3 form-label">Nominees:</div>
          {form.nominees.map((nominee, index) => (
            <div key={index} className="mb-3 nominee-row">
              <div className="d-flex gap-2">
                <div className="w-50">
                  <label htmlFor={`${type}-nominee-${index}`} className="form-label">Nominee {index + 1} Name <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    id={`${type}-nominee-${index}`}
                    value={nominee.nomineeId}
                    onChange={(e) => handleNomineeChange(index, "nomineeId", e.target.value)}
                    required
                  >
                    <option value="">Select Nominee</option>
                    {familyMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.fullName} {member.relation.toLowerCase() === "self" ? "(Self)" : ""}
                      </option>
                    ))}
                  </select>

                  <datalist id={`family-options-${index}`}>
                    {familyMembers.map((member) => (
                      <option key={member._id} value={member.fullName} />
                    ))}
                  </datalist>
                </div>
                <div className="w-25">
                  <label htmlFor={`${type}-percentage-${index}`} className="form-label">Percentage <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    className="form-control"
                    id={`${type}-percentage-${index}`}
                    value={nominee.percentage}
                    onChange={(e) => handleNomineeChange(index, "percentage", e.target.value)}
                    placeholder="0-100"
                    min="0"
                    max="100"
                    required={nominee.name !== "" || (form.nominees.length === 1 && index === 0)} // Required if name exists or if it's the only (first) nominee
                    aria-required={nominee.name !== "" || (form.nominees.length === 1 && index === 0)}
                  />
                </div>
                {index > 0 && ( // Allow removing only if there's more than one nominee field
                  <button
                    type="button"
                    className="btn btn-outline-danger mt-4"
                    onClick={() => removeNominee(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-outline-secondary mb-3" onClick={addNominee}>
            Add Another Nominee
          </button>

          <div className="d-flex justify-content-between flex-wrap gap-2">
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
