import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  Form,
  Card,
  Container,
  ButtonGroup,
  ToggleButton,
  Image, // Import Image component for displaying member images
  Row, // Ensure Row is imported
  Col // Ensure Col is imported
} from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import { FaEdit, FaTrashAlt, FaCrown } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { auth } from '../firebase';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import './FamilyTree.css'; // Assuming this CSS file will be updated for responsiveness

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const WealthPlanning = () => {
  const [userId, setUserId] = useState('');
  const [family, setFamily] = useState([]);
  const [assets, setAssets] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [entry, setEntry] = useState({
    type: '',
    itemId: '',
    nomineeId: '',
    percentage: 0,
  });
  const [member, setMember] = useState({
    fullName: '',
    relation: '',
    pan: '',
    phone: '',
    nominee: false,
    image: '', // Added image field to member state
  });
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editFamilyId, setEditFamilyId] = useState(null);
  const [activeTab, setActiveTab] = useState('tree');

  const nodeRefs = useRef({});
  const treeContainerRef = useRef(null);
  const addMemberFormRef = useRef(null);

  // Index-based cache for fast lookups
  const familyIndex = useMemo(() => {
    return family.reduce((acc, item) => ({ ...acc, [item._id]: item }), {});
  }, [family]);

  const assetsIndex = useMemo(() => {
    return assets.reduce((acc, item) => ({ ...acc, [item._id]: item }), {});
  }, [assets]);

  const investmentsIndex = useMemo(() => {
    return investments.reduce((acc, item) => ({ ...acc, [item._id]: item }), {});
  }, [investments]); // Corrected dependency to investments

  const nomineesIndex = useMemo(() => {
    return nominees.reduce((acc, item) => ({ ...acc, [item._id]: item }), {});
  }, [nominees]);

  useEffect(() => {
    auth.onAuthStateChanged((user) => {
      if (user) setUserId(user.uid);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    axios
      .get(`https://backend-pbmi.onrender.com/api/family?userId=${userId}`)
      .then((res) => setFamily(res.data))
      .catch(err => console.error("Error fetching family members:", err));
    axios
      .get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`)
      .then((res) => setAssets(res.data))
      .catch(err => console.error("Error fetching assets:", err));
    axios
      .get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`)
      .then((res) => setInvestments(res.data))
      .catch(err => console.error("Error fetching investments:", err));
    axios
      .get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`)
      .then((res) => setNominees(res.data))
      .catch(err => console.error("Error fetching nominees:", err));
  }, [userId]);

  const isValidPAN = !member.pan || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(member.pan);
  const isValidPhone = !member.phone || /^[6-9]\d{9}$/.test(member.phone);
  // Image is now mandatory
  const isFamilyValid = member.fullName && member.relation && isValidPAN && isValidPhone && member.image;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMember(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setMember(prev => ({ ...prev, image: '' }));
    }
  };

  const handleAddFamily = async () => {
    try {
      if (editFamilyId) {
        await axios.put(`https://backend-pbmi.onrender.com/api/family/${editFamilyId}`, { ...member, userId });
      } else {
        await axios.post(`https://backend-pbmi.onrender.com/api/family`, { ...member, userId });
      }
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/family?userId=${userId}`);
      setFamily(res.data);
      setMember({ fullName: '', relation: '', pan: '', phone: '', nominee: false, image: '' }); // Reset image
      setEditFamilyId(null);
      setShowFamilyForm(false);
      toast.success(editFamilyId ? 'Updated family member' : 'Added family member');
    } catch (error) {
      toast.error('Failed to save family member.');
      console.error('Error saving family member:', error);
    }
  };

  const handleEditFamily = (f) => {
    setMember(f);
    setEditFamilyId(f._id);
    setShowFamilyForm(true);
    setTimeout(() => {
      addMemberFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeleteFamily = async (id) => {
    const originalFamily = family; // Store original state for rollback
    // Optimistic UI update: immediately filter out the deleted member
    setFamily(prevFamily => prevFamily.filter(f => f._id !== id));
    toast.success('Deleting family member...'); // Immediate feedback

    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/family/${id}`);
      toast.success('Family member deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete family member. Rolling back...');
      console.error('Error deleting family member:', error);
      setFamily(originalFamily); // Rollback if deletion fails
    }
  };

  const handleEdit = (n) => {
    setEntry({
      type: n.type,
      itemId: n.itemId?._id || n.itemId,
      nomineeId: n.nomineeId?._id || n.nomineeId,
      percentage: n.percentage,
    });
    setEditId(n._id);
    setActiveTab('nominee');
  };

  const toggleFavorite = (id) => {
    // Optimistic UI update
    setNominees((prev) =>
      prev.map((n) =>
        n._id === id ? { ...n, favorite: !n.favorite } : n
      )
    );

    // Fire-and-forget backend update
    axios
      .patch(`https://backend-pbmi.onrender.com/api/nominees/${id}/favorite`)
      .then(() => {
        toast.success("Favorite updated");
      })
      .catch((err) => {
        toast.error("Failed to update favorite");
        console.error("Favorite toggle error:", err);
        // Revert if failed
        setNominees((prev) =>
          prev.map((n) =>
            n._id === id ? { ...n, favorite: !n.favorite } : n
          )
        );
      });
  };


  const handleAddNominee = async () => {
    if (!entry.itemId || !entry.nomineeId || entry.percentage === '') {
      return toast.error('All fields are required');
    }

    const current = nominees.filter(
      (n) =>
        n.type === entry.type &&
        (n.itemId?._id || n.itemId) === entry.itemId &&
        (n.nomineeId?._id || n.nomineeId) === entry.nomineeId &&
        n._id !== editId
    );

    const total = current.reduce((sum, n) => sum + n.percentage, 0) + Number(entry.percentage);
    if (total > 100) return toast.error('Total % exceeds 100');

    try {
      // ✅ If a nominee already exists for this item and person, update it instead
      const existing = nominees.find(
        (n) =>
          n.type === entry.type &&
          (n.itemId?._id || n.itemId) === entry.itemId &&
          (n.nomineeId?._id || n.nomineeId) === entry.nomineeId
      );

      if (existing && !editId) {
        await axios.patch(`https://backend-pbmi.onrender.com/api/nominees/${existing._id}`, {
          userId,
          ...entry,
          percentage: Number(entry.percentage),
        });
        toast.success('Updated existing nominee');
      } else if (editId) {
        await axios.patch(`https://backend-pbmi.onrender.com/api/nominees/${editId}`, {
          userId,
          ...entry,
          percentage: Number(entry.percentage),
        });
        toast.success('Updated nominee');
      } else {
        await axios.post(`https://backend-pbmi.onrender.com/api/nominees`, {
          userId,
          ...entry,
          percentage: Number(entry.percentage),
        });
        toast.success('Added nominee');
      }

      const res = await axios.get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`);
      setNominees(res.data);
      setEntry({ type: '', itemId: '', nomineeId: '', percentage: 0 });
      setEditId(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save nominee');
      console.error('Error saving nominee:', err);
    }
  };


  const handleDelete = async (id) => {
    const originalNominees = nominees; // Store original state for rollback
    // Optimistic UI update: immediately filter out the deleted nominee
    setNominees((prev) => prev.filter((n) => n._id !== id));
    toast.success('Deleting nominee...'); // Immediate feedback

    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/nominees/${id}`);
      toast.success('Nominee deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete nominee. Rolling back...');
      console.error('Error deleting nominee:', error);
      setNominees(originalNominees); // Rollback if deletion fails
    }
  };

  const tabs = [
    { id: 'tree', label: 'Family Tree' },
    { id: 'charts', label: 'Allocation Charts' },
    { id: 'nominee', label: 'Nominee Manager' },
    { id: 'Uploads', label: 'Card View' },
  ];

  const getNomineeChartData = (type, itemId) => {
    const allocations = nominees.filter(
      (n) => n.type === type && (n.itemId?._id || n.itemId) === itemId
    );
    const totalAllocated = allocations.reduce((sum, n) => sum + n.percentage, 0);
    const data = allocations.map((n) => ({
      name: familyIndex[n.nomineeId?._id || n.nomineeId]?.fullName || 'Unknown',
      value: n.percentage,
    }));
    if (totalAllocated < 100) {
      data.push({ name: 'Not Allocated', value: 100 - totalAllocated });
    }
    return data;
  };

  const getAssetsForMember = (memberId) => {
    return nominees
      .filter(n => (n.nomineeId?._id || n.nomineeId) === memberId)
      .map(n => ({
        type: n.type,
        itemId: n.itemId,
        percentage: n.percentage,
        name: (n.type === 'asset' ? assetsIndex[n.itemId?._id || n.itemId]?.name : investmentsIndex[n.itemId?._id || n.itemId]?.name) || 'Unknown'
      }));
  };

  const father = family.find(f => f.relation.toLowerCase() === 'father');
  const mother = family.find(f => f.relation.toLowerCase() === 'mother');
  const self = family.find(f => f.relation.toLowerCase() === 'self') || { _id: 'self-node', fullName: 'You', relation: 'Self' };
  const spouse = family.find(f => f.relation.toLowerCase() === 'spouse');
  const children = family.filter(f => f.relation.toLowerCase() === 'child');
  const siblings = family.filter(f => f.relation.toLowerCase() === 'sibling');

  const getNodePosition = useCallback((id) => {
    const nodeElement = nodeRefs.current[id];
    const containerElement = treeContainerRef.current;

    if (nodeElement && containerElement) {
      const nodeRect = nodeElement.getBoundingClientRect();
      const containerRect = containerElement.getBoundingClientRect();

      return {
        x: nodeRect.left + nodeRect.width / 2 - containerRect.left,
        y: nodeRect.top + nodeRect.height / 2 - containerRect.top,
        width: nodeRect.width,
        height: nodeRect.height,
      };
    }
    return null;
  }, [family]);

  const renderConnectors = useCallback(() => {
    // This function is currently a placeholder.
    // For a truly dynamic and responsive family tree,
    // you would typically draw SVG lines here based on node positions.
    // Given the complexity, for responsiveness, we'll focus on node layout.
    return <svg className="connector-group" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}></svg>;
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (treeContainerRef.current) {
        renderConnectors();
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [family, renderConnectors, activeTab]);

  const handleAddMemberClick = () => {
    setShowFamilyForm(!showFamilyForm);
    if (!showFamilyForm) {
      setTimeout(() => {
        addMemberFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  return (
    <Container fluid className="my-4 p-0"> {/* Use fluid for full width */}
      <ToastContainer />
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center my-3 px-2"> {/* Responsive flex */}
        <h3 className="text-primary font-weight-bold mb-2 mb-md-0" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem' }}>Wealth Planning</h3>
        <Button
          variant="success"
          onClick={handleAddMemberClick}
          className="w-100 w-md-auto" // Full width on small screens, auto on medium+
        >
          + Add Member
        </Button>
      </div>

      <ButtonGroup className="mb-4 px-2 d-flex flex-wrap"> {/* Responsive button group */}
        {tabs.map((tab) => (
          <ToggleButton
            key={tab.id}
            id={`tab-${tab.id}`}
            type="radio"
            variant="outline-primary"
            name="tab"
            value={tab.id}
            checked={activeTab === tab.id}
            onChange={(e) => setActiveTab(e.currentTarget.value)}
            className="flex-grow-1 mb-1 mb-md-0 me-md-1" // Flex grow for even distribution, margin for spacing
          >
            {tab.label}
          </ToggleButton>
        ))}
      </ButtonGroup>

      {activeTab === 'tree' && (
        <Card className="p-3 family-tree-card">
          <h5 className="text-center mb-3 font-weight-bold text-secondary" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.5rem' }}>Family Tree</h5>
          <div className="family-tree-container" ref={treeContainerRef} style={{ padding: '0', overflowX: 'auto' }}> {/* Allow horizontal scroll for tree */}
            {renderConnectors()}

            {(father || mother) && (
              <div className="generation-layer parents-layer d-flex flex-wrap justify-content-center mb-4"> {/* Added mb-4 */}
                <p className="w-100 text-center mb-2" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.2rem' }}>Parents Generation</p>
                {father && (
                  <div key={father._id} ref={el => nodeRefs.current[father._id] = el} className="tree-node parent-node mx-2 my-2"> {/* Added my-2 */}
                    <div className="node-content">
                      {father.image && <Image src={father.image} roundedCircle className="member-image mb-2" />}
                      <FaCrown className="crown-icon" />
                      <strong>{father.fullName}</strong>
                      <span>Father</span>
                    </div>
                  </div>
                )}
                {father && mother && <span className="d-flex align-items-center mx-2" style={{ fontSize: '24px' }}>*</span>} {/* Align vertically */}
                {mother && (
                  <div key={mother._id} ref={el => nodeRefs.current[mother._id] = el} className="tree-node parent-node mx-2 my-2">
                    <div className="node-content">
                      {mother.image && <Image src={mother.image} roundedCircle className="member-image mb-2" />}
                      <FaCrown className="crown-icon" />
                      <strong>{mother.fullName}</strong>
                      <span>Mother</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(father || mother) && (
              <div className="yellow-line" style={{ borderTop: '3px solid #ffcc00', width: '100%', margin: '20px 0' }}></div>
            )}
            <div className="generation-layer you-spouse-sibling-layer d-flex flex-wrap justify-content-center mb-4"> {/* Added mb-4 */}
              <p className="w-100 text-center" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.2rem' }}>Our Generation</p>

              {siblings.length > 0 && (
                <div className="sibling-branch sibling-left d-flex flex-wrap justify-content-center"> {/* Centered siblings */}
                  {siblings.map((s) => (
                    <div key={s._id} ref={el => nodeRefs.current[s._id] = el} className="tree-node sibling-node mx-2 my-2">
                      <div className="node-content">
                        {s.image && <Image src={s.image} roundedCircle className="member-image mb-2" />}
                        <strong>{s.fullName}</strong>
                        <span>Sibling</span>
                        <div className="asset-list">
                          {getAssetsForMember(s._id).map((asset, index) => (
                            <div key={index} className="asset-info">
                              {asset.name} ({asset.type}: {asset.percentage}%)
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div key={self._id || 'self-node'} ref={el => nodeRefs.current[self._id || 'self-node'] = el} className="tree-node self-node mx-2 my-2">
                <div className="node-content">
                  {self.image && <Image src={self.image} roundedCircle className="member-image mb-2" />}
                  <FaCrown className="crown-icon" />
                  <strong>{self.fullName || 'You'}</strong>
                  <span>Self</span>
                  {getAssetsForMember(self._id).map((asset, index) => (
                    <div key={index} className="asset-info">
                      {asset.name} ({asset.type}: {asset.percentage}%)
                    </div>
                  ))}
                </div>
              </div>

              {self && spouse && <span className="d-flex align-items-center mx-2" style={{ fontSize: '24px' }}>*</span>}
              {spouse && (
                <div key={spouse._id} ref={el => nodeRefs.current[spouse._id] = el} className="tree-node spouse-node mx-2 my-2">
                  <div className="node-content">
                    {spouse.image && <Image src={spouse.image} roundedCircle className="member-image mb-2" />}
                    <strong>{spouse.fullName}</strong>
                    <span>Spouse</span>
                    <div className="asset-list">
                      {getAssetsForMember(spouse._id).map((asset, index) => (
                        <div key={index} className="asset-info">
                          {asset.name} ({asset.type}: {asset.percentage}%)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(self || spouse || siblings.length > 0) && (
              <div className="yellow-line" style={{ borderTop: '3px solid #ffcc00', width: '100%', margin: '20px 0' }}></div>
            )}

            {children.length > 0 && (
              <div className="generation-layer children-layer d-flex flex-wrap justify-content-center">
                <p className="w-100 text-center mb-2" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.2rem' }}>Next Generation</p>

                {children.map((c) => (
                  <div key={c._id} ref={el => nodeRefs.current[c._id] = el} className="tree-node child-node mx-2 my-2">
                    <div className="node-content">
                      {c.image && <Image src={c.image} roundedCircle className="member-image mb-2" />}
                      <strong>{c.fullName}</strong>
                      <span>Child</span>
                      <div className="asset-list">
                        {getAssetsForMember(c._id).map((asset, index) => (
                          <div key={index} className="asset-info">
                            {asset.name} ({asset.type}: {asset.percentage}%)
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'charts' && (
        <Row className="g-3 px-2"> {/* Use Row and Col for responsive charts */}
          {[...assets.map((a) => ({ ...a, type: 'asset' })), ...investments.map((i) => ({ ...i, type: 'investment' }))].map((item) => (
            <Col xs={12} md={6} key={item._id}> {/* Take full width on small, half on medium+ */}
              <Card className="p-3 h-100"> {/* Ensure cards take full height */}
                <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>
                  {item.type.toUpperCase()} → {item.name}
                </h5>

                <div style={{ marginBottom: '2rem', flexGrow: 1 }}> {/* Flex grow to push chart down */}
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={getNomineeChartData(item.type, item._id)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {getNomineeChartData(item.type, item._id).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {activeTab === 'nominee' && (
        <Card className="p-3 mb-4 mx-2">
          <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>Nominee Manager</h5>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>Select Type</Form.Label>
              <Form.Select value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value, itemId: '' })}>
                <option value="">Select Type</option>
                <option value="asset">Asset</option>
                <option value="investment">Investment</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Select Item</Form.Label>
              <Form.Select value={entry.itemId} onChange={(e) => setEntry({ ...entry, itemId: e.target.value })}>
                <option value="">Select Item</option>
                {(entry.type === 'asset' ? assets : investments).map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Select Family Member</Form.Label>
              <Form.Select
                value={entry.nomineeId}
                onChange={(e) => setEntry({ ...entry, nomineeId: e.target.value })}
              >
                <option value="">Select Family Member</option>
                {family.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.fullName} {f.relation.toLowerCase() === "self" ? "(Self)" : ""}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Percentage</Form.Label>
              <Form.Control type="number" value={entry.percentage} placeholder="Percentage" onChange={(e) => setEntry({ ...entry, percentage: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            </Form.Group>
            <Button onClick={handleAddNominee} className="w-100">{editId ? 'Update' : 'Save'} Nominee</Button>
          </Form>
          <h6 className="mt-4 font-weight-bold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.1rem' }}>Existing Nominees</h6>
          <ul className="list-unstyled">
            {nominees.map((n) => (
              <li key={n._id} className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center border rounded p-2 mb-2 bg-light"> {/* Responsive flex */}
                <div className="mb-2 mb-sm-0">
                  <strong>{n.nomineeName}</strong> → {n.percentage}% ({n.type === 'asset' ? assetsIndex[n.itemId]?.name : investmentsIndex[n.itemId]?.name || 'Unknown'})
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Button variant="outline-danger" size="sm" onClick={() => toggleFavorite(n._id)}>
                    {n.favorite ? <FaHeart /> : <FaRegHeart />}
                  </Button>
                  <Button size="sm" variant="warning" onClick={() => handleEdit(n)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(n._id)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {activeTab === 'Uploads' && (
        <Card className="p-3 mx-2">
          <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>Card View</h5>
          <h6 className="mt-3 font-weight-bold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.1rem' }}>Nominees</h6>
          <Row className="g-3"> {/* Use Row and Col for responsive layout */}
            {nominees.map((n) => (
              <Col xs={12} sm={6} md={4} lg={3} key={n._id}> {/* Responsive cols */}
                <Card className="h-100 shadow-sm">
                  <Card.Body>
                    <Card.Title>{n.nomineeName}</Card.Title>
                    <Card.Text>
                      Percentage: {n.percentage}%<br />
                      Type: {n.type}<br />
                      Item: {n.type === 'asset' ? assetsIndex[n.itemId]?.name : investmentsIndex[n.itemId]?.name || 'Unknown'}
                    </Card.Text>
                    <div className="d-flex justify-content-end gap-2">
                      <Button size="sm" variant="outline-primary" onClick={() => handleEdit(n)}><FaEdit /></Button>
                      <Button size="sm" variant="outline-danger" onClick={() => handleDelete(n._id)}><FaTrashAlt /></Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <h6 className="mt-3 font-weight-bold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.1rem' }}>Family Members</h6>
          <Row className="g-3"> {/* Use Row and Col for responsive layout */}
            {family.map((f) => (
              <Col xs={12} sm={6} md={4} lg={3} key={f._id}> {/* Responsive cols */}
                <Card className="h-100 shadow-sm">
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      {f.image && <Image src={f.image} roundedCircle style={{ width: '50px', height: '50px', marginRight: '10px', objectFit: 'cover' }} />}
                      <Card.Title className="mb-0">{f.fullName}</Card.Title>
                    </div>
                    <Card.Text>
                      Relation: {f.relation}<br />
                      Phone: {f.phone}<br />
                      PAN: {f.pan || 'N/A'}
                    </Card.Text>
                    <div className="d-flex justify-content-end gap-2">
                      <Button size="sm" variant="outline-primary" onClick={() => handleEditFamily(f)}><FaEdit /></Button>
                      <Button size="sm" variant="outline-danger" onClick={() => handleDeleteFamily(f._id)}><FaTrashAlt /></Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {showFamilyForm && (
        <Card className="p-3 mt-4 mx-2" ref={addMemberFormRef}>
          <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>{editFamilyId ? 'Edit' : 'Add'} Family Member</h5>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>Full Name <span style={{ color: 'red' }}>*</span></Form.Label>
              <Form.Control placeholder="Full Name" value={member.fullName} onChange={(e) => setMember({ ...member, fullName: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Relation <span style={{ color: 'red' }}>*</span></Form.Label>
              <Form.Select value={member.relation} onChange={(e) => setMember({ ...member, relation: e.target.value })} required>
                <option value="">Select Relation</option>
                <option>Spouse</option>
                <option>Child</option>
                <option>Father</option>
                <option>Mother</option>
                <option>Sibling</option>
                <option>Self</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>PAN <span style={{ color: 'red' }}>*</span></Form.Label>
              <Form.Control placeholder="PAN" value={member.pan} onChange={(e) => setMember({ ...member, pan: e.target.value.toUpperCase() })} isInvalid={member.pan && !isValidPAN} />
              <Form.Control.Feedback type="invalid">
                Please enter a valid PAN (e.g., ABCDE1234F).
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Phone <span style={{ color: 'red' }}>*</span></Form.Label>
              <Form.Control placeholder="Phone" value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} isInvalid={member.phone && !isValidPhone} />
              <Form.Control.Feedback type="invalid">
                Please enter a valid 10-digit phone number.
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Image <span style={{ color: 'red' }}>*</span></Form.Label>
              <Form.Control type="file" accept="image/*" onChange={handleImageChange} required={!editFamilyId || !member.image} />
              {member.image && (
                <div className="mt-2 text-center">
                  <Image src={member.image} thumbnail style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover' }} />
                </div>
              )}
            </Form.Group>
            <Button disabled={!isFamilyValid} onClick={handleAddFamily} className="w-100">{editFamilyId ? 'Update' : 'Save'} Family Member</Button>
          </Form>
        </Card>
      )}
    </Container>
  );
};

export default WealthPlanning;
