// src/components/UserProfile.js
import React, { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const UserProfile = () => {
  const [userData, setUserData] = useState(null);
  const db = getFirestore();

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      }
    };

    fetchUserData();
  }, []);

  if (!userData) return <div>Loading...</div>;

  return (
    <div>
      <h2>Welcome, {userData.fullName}</h2>
      <p>Email: {auth.currentUser.email}</p>
      <p>Phone: {userData.phone}</p>
      {/* Display other user details as needed */}
    </div>
  );
};

export default UserProfile;
