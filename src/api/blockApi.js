const BASE_URL = "https://backend-pbmi.onrender.com/api/custom-blocks"; 

export const createCustomBlock = async (userId, blockName) => {
  const res = await fetch(`${BASE_URL}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, blockName }),
  });
  if (!res.ok) throw new Error("Block creation failed");
  return res.json();
};

export const getUserBlocks = async (userId) => {
  const res = await fetch(`${BASE_URL}/user/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch user blocks");
  return res.json();
};

export const deleteCustomBlock = async (blockId) => {
  const res = await fetch(`${BASE_URL}/${blockId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete block");
  return res.json();
};
