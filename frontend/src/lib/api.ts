const BASE_URL = process.env.NEXT_PUBLIC_API_URL as string;
console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);

// 🔐 Token helpers
export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function removeToken() {
  localStorage.removeItem("token");
}

// 🔥 API wrapper
export async function apiFetch(endpoint: string, options: any = {}) {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      data?.detail ||
      data?.error ||
      "Something went wrong"
    );
  }

  return data;
}