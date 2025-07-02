// WealthPlanning.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  Form,
  Card,
  Container,
  ButtonGroup,
  ToggleButton,
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
import './FamilyTree.css';

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
  }, [nominees]);

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
      .then((res) => setFamily(res.data));
    axios
      .get(`https://backend-pbmi.onrender.com/api/assets?userId=${userId}`)
      .then((res) => setAssets(res.data));
    axios
      .get(`https://backend-pbmi.onrender.com/api/investments?userId=${userId}`)
      .then((res) => setInvestments(res.data));
    axios
      .get(`https://backend-pbmi.onrender.com/api/nominees?userId=${userId}`)
      .then((res) => setNominees(res.data));
  }, [userId]);

  const isValidPAN = !member.pan || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(member.pan);
  const isValidPhone = !member.phone || /^[6-9]\d{9}$/.test(member.phone);
  const isFamilyValid = member.fullName && member.relation && isValidPAN && isValidPhone;

  const handleAddFamily = async () => {
    try {
      if (editFamilyId) {
        await axios.put(`https://backend-pbmi.onrender.com/api/family/${editFamilyId}`, { ...member, userId });
      } else {
        await axios.post(`https://backend-pbmi.onrender.com/api/family`, { ...member, userId });
      }
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/family?userId=${userId}`);
      setFamily(res.data);
      setMember({ fullName: '', relation: '', pan: '', phone: '', nominee: false });
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
    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/family/${id}`);
      const res = await axios.get(`https://backend-pbmi.onrender.com/api/family?userId=${userId}`);
      setFamily(res.data);
      toast.success('Deleted family member');
    } catch (error) {
      toast.error('Failed to delete family member.');
      console.error('Error deleting family member:', error);
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
    try {
      await axios.delete(`https://backend-pbmi.onrender.com/api/nominees/${id}`);
      setNominees((prev) => prev.filter((n) => n._id !== id));
      toast.success('Deleted nominee');
    } catch (error) {
      toast.error('Failed to delete nominee.');
      console.error('Error deleting nominee:', error);
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
    return <svg className="connector-group" width={0} height={0}></svg>;
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
    <Container className="my-4 p-0">
      <ToastContainer />
      <div className="d-flex justify-content-between align-items-center my-3 px-2">
        <h3 className="text-primary font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem' }}>Wealth Planning</h3>
        <Button
          variant="success"
          onClick={handleAddMemberClick}
          className="ms-2"
        >
          + Add Member
        </Button>
      </div>

      <ButtonGroup className="mb-4 px-2">
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
            className="me-1"
          >
            {tab.label}
          </ToggleButton>
        ))}
      </ButtonGroup>

      {activeTab === 'tree' && (
        <Card className="p-3 family-tree-card">
          <h5 className="text-center mb-3 font-weight-bold text-secondary" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.5rem' }}>Family Tree</h5>
          <div className="family-tree-container" ref={treeContainerRef} style={{ padding: '0' }}>
            {renderConnectors()}

            {(father || mother) && (
              <div className="generation-layer grandparents-layer d-flex flex-wrap justify-content-center">
                <p className="w-100 text-center mb-2" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.2rem' }}>Parents Generation</p>
                {father && (
                  <div key={father._id} ref={el => nodeRefs.current[father._id] = el} className="tree-node parent-node mx-1">
                    <div className="node-content">
                      <FaCrown className="crown-icon" />
                      <strong>{father.fullName}</strong>
                      <span>Father</span>
                    </div>
                  </div>
                )}
                {father && mother && <span style={{ fontSize: '24px', margin: '0 5px' }}>*</span>}
                {mother && (
                  <div key={mother._id} ref={el => nodeRefs.current[mother._id] = el} className="tree-node parent-node mx-1">
                    <div className="node-content">
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
            <div className="generation-layer you-spouse-sibling-layer d-flex flex-wrap justify-content-center">
              <p className="w-100 text-center" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.2rem' }}>Our Generation</p>

              {siblings.length > 0 && (
                <div className="sibling-branch sibling-left d-flex flex-wrap">
                  {siblings.map((s) => (
                    <div key={s._id} ref={el => nodeRefs.current[s._id] = el} className="tree-node sibling-node mx-1">
                      <div className="node-content">
                        <strong>{s.fullName}</strong>
                        <span>Sibling</span>
                        {getAssetsForMember(s._id).map((asset, index) => (
                          <div key={index} className="asset-info">
                            {asset.name} ({asset.type}: {asset.percentage}%)
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div key={self._id || 'self-node'} ref={el => nodeRefs.current[self._id || 'self-node'] = el} className="tree-node self-node mx-1">
                <div className="node-content">
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

              {self && spouse && <span style={{ fontSize: '24px', margin: '0 5px' }}>*</span>}
              {spouse && (
                <div key={spouse._id} ref={el => nodeRefs.current[spouse._id] = el} className="tree-node spouse-node mx-1">
                  <div className="node-content">
                    <strong>{spouse.fullName}</strong>
                    <span>Spouse</span>
                    {getAssetsForMember(spouse._id).map((asset, index) => (
                      <div key={index} className="asset-info">
                        {asset.name} ({asset.type}: {asset.percentage}%)
                      </div>
                    ))}
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
                  <div key={c._id} ref={el => nodeRefs.current[c._id] = el} className="tree-node child-node mx-1">
                    <div className="node-content">
                      <strong>{c.fullName}</strong>
                      <span>Child</span>
                      {getAssetsForMember(c._id).map((asset, index) => (
                        <div key={index} className="asset-info">
                          {asset.name} ({asset.type}: {asset.percentage}%)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'charts' && (
        <>
          {[...assets.map((a) => ({ ...a, type: 'asset' })), ...investments.map((i) => ({ ...i, type: 'investment' }))].map((item) => (
            <Card className="p-3 mb-4 mx-2" key={item._id}>
              <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>{item.type.toUpperCase()} → {item.name}</h5>
              <ResponsiveContainer width="100%" height={250}>
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
            </Card>
          ))}
        </>
      )}

      {activeTab === 'nominee' && (
        <Card className="p-3 mb-4 mx-2">
          <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>Nominee Manager</h5>
          <Form>
            <Form.Select className="mb-2" value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value, itemId: '' })}>
              <option value="">Select Type</option>
              <option value="asset">Asset</option>
              <option value="investment">Investment</option>
            </Form.Select>
            <Form.Select className="mb-2" value={entry.itemId} onChange={(e) => setEntry({ ...entry, itemId: e.target.value })}>
              <option value="">Select Item</option>
              {(entry.type === 'asset' ? assets : investments).map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </Form.Select>
            <Form.Select className="mb-2" value={entry.nomineeId} onChange={(e) => setEntry({ ...entry, nomineeId: e.target.value })}>
              <option value="">Select Family Member</option>
              {family.map((f) => (
                <option key={f._id} value={f._id}>{f.fullName}</option>
              ))}
            </Form.Select>
            <Form.Control className="mb-2" type="number" value={entry.percentage} placeholder="Percentage" onChange={(e) => setEntry({ ...entry, percentage: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            <Button onClick={handleAddNominee}>{editId ? 'Update' : 'Save'} Nominee</Button>
          </Form>
          <h6 className="mt-4 font-weight-bold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.1rem' }}>Existing Nominees</h6>
          <ul className="list-unstyled">
            {nominees.map((n) => (
  <div key={n._id} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2 bg-light">
    <div>
      <strong>{n.nomineeName}</strong> → {n.percentage}% ({n.type === 'asset' ? assetsIndex[n.itemId]?.name : investmentsIndex[n.itemId]?.name || 'Unknown'})
    </div>
    <div className="d-flex align-items-center gap-2">
      <Button variant="outline-danger" size="sm" onClick={() => toggleFavorite(n._id)}>
        {n.favorite ? <FaHeart /> : <FaRegHeart />}
      </Button>
      <Button size="sm" variant="warning" onClick={() => handleEdit(n)}>Edit</Button>
      <Button size="sm" variant="danger" onClick={() => handleDelete(n._id)}>Delete</Button>
    </div>
  </div>
))}
          </ul>
        </Card>
      )}

      {activeTab === 'Uploads' && (
        <Card className="p-3 mx-2">
          <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>Card View</h5>
          <h6 className="mt-3 font-weight-bold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.1rem' }}>Nominees</h6>
          <ul className="list-unstyled">
            {nominees.map((n) => (
              <li key={n._id} className="d-flex justify-content-between align-items-center py-2">
                <span>{n.nomineeName} → {n.percentage}% ({n.type})</span>
                <span>
                  <Button size="sm" variant="outline-primary" className="me-2" onClick={() => handleEdit(n)}><FaEdit /></Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleDelete(n._id)}><FaTrashAlt /></Button>
                </span>
              </li>
            ))}
          </ul>
          <h6 className="mt-3 font-weight-bold" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '1.1rem' }}>Family Members</h6>
          <ul className="list-unstyled">
            {family.map((f) => (
              <li key={f._id} className="d-flex justify-content-between align-items-center py-2">
                <span>{f.fullName} ({f.relation}) - {f.phone}</span>
                <span>
                  <Button size="sm" variant="outline-primary" className="me-2" onClick={() => handleEditFamily(f)}><FaEdit /></Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleDeleteFamily(f._id)}><FaTrashAlt /></Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showFamilyForm && (
        <Card className="p-3 mt-4 mx-2" ref={addMemberFormRef}>
          <h5 className="font-weight-bold" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem' }}>{editFamilyId ? 'Edit' : 'Add'} Family Member</h5>
          <Form>
            <Form.Control className="mb-2" placeholder="Full Name" value={member.fullName} onChange={(e) => setMember({ ...member, fullName: e.target.value })} />
            <Form.Select className="mb-2" value={member.relation} onChange={(e) => setMember({ ...member, relation: e.target.value })}>
              <option>Select Relation</option>
              <option>Spouse</option>
              <option>Child</option>
              <option>Father</option>
              <option>Mother</option>
              <option>Sibling</option>
              <option>Self</option>
            </Form.Select>
            <Form.Control className="mb-2" placeholder="PAN" value={member.pan} onChange={(e) => setMember({ ...member, pan: e.target.value.toUpperCase() })} isInvalid={member.pan && !isValidPAN} />
            <Form.Control className="mb-2" placeholder="Phone" value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} isInvalid={member.phone && !isValidPhone} />
            <Button disabled={!isFamilyValid} onClick={handleAddFamily}>{editFamilyId ? 'Update' : 'Save'} Family Member</Button>
          </Form>
        </Card>
      )}
    </Container>
  );
};

export default WealthPlanning;