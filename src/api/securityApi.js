export const updateSecurityConfig = async (userId, config) => {
  const res = await fetch(`/api/security/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
};

export const getSecurityConfig = async (userId) => {
  const res = await fetch(`/api/security/${userId}`);
  return res.json();
};