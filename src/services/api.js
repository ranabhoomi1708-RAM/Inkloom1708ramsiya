// API Client with Live Backend and Offline Mock Adapter Fallback

const API_BASE = import.meta.env.VITE_API_URL || "";

let currentRole = localStorage.getItem("inkloom_role") || "employee";
let authToken = localStorage.getItem("inkloom_token") || `demo-token-${currentRole}`;

export const setAuthRole = (role) => {
  currentRole = role;
  authToken = `demo-token-${role}`;
  localStorage.setItem("inkloom_role", role);
  localStorage.setItem("inkloom_token", authToken);
};

export const getAuthRole = () => currentRole;

const getHeaders = (isMultipart = false) => {
  const headers = {
    "X-Demo-Role": currentRole,
    "Authorization": `Bearer ${authToken}`,
  };
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

// Generic fetch wrapper with graceful error handling
async function request(endpoint, options = {}) {
  const isMultipart = options.body instanceof FormData;
  const config = {
    ...options,
    headers: {
      ...getHeaders(isMultipart),
      ...(options.headers || {}),
    },
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.detail || errData.message || `Request failed (${res.status})`);
      error.status = res.status;
      error.data = errData;
      throw error;
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[Live API error on ${endpoint}]:`, err.message);
    throw err;
  }
}

// API Service Functions
export const api = {
  // Auth
  auth: {
    login: async (role) => {
      setAuthRole(role);
      try {
        const data = await request("/api/auth/demo-login", {
          method: "POST",
          body: JSON.stringify({ role }),
        });
        return data;
      } catch {
        return {
          access_token: `demo-token-${role}`,
          token_type: "bearer",
          user: {
            id: role === "admin" ? 1 : role === "employee" ? 2 : 3,
            email: `${role}@glowleaf.in`,
            name: role === "admin" ? "Priya Sharma" : role === "employee" ? "Arjun Mehta" : "Kavita Rao",
            role: role,
            department: role === "admin" ? "Brand Governance" : role === "employee" ? "Performance Marketing" : "Legal & Compliance",
          }
        };
      }
    },
    getMe: async () => {
      return request("/api/auth/me");
    },
  },

  // Brand
  brand: {
    get: async () => request("/api/brand"),
    update: async (data) => request("/api/brand", { method: "POST", body: JSON.stringify(data) }),
  },

  // Facts
  facts: {
    list: async (includeExpired = true, includeSuperseded = true) =>
      request(`/api/facts?include_expired=${includeExpired}&include_superseded=${includeSuperseded}`),
    create: async (data) => request("/api/facts", { method: "POST", body: JSON.stringify(data) }),
    update: async (id, data) => request(`/api/facts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: async (id) => request(`/api/facts/${id}`, { method: "DELETE" }),
  },

  // Rules
  rules: {
    list: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.severity) params.append("severity", filters.severity);
      if (filters.pack) params.append("pack", filters.pack);
      return request(`/api/rules?${params.toString()}`);
    },
    create: async (data) => request("/api/rules", { method: "POST", body: JSON.stringify(data) }),
    update: async (id, data) => request(`/api/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: async (id) => request(`/api/rules/${id}`, { method: "DELETE" }),
  },

  // Guidelines
  guidelines: {
    list: async () => request("/api/guidelines"),
    upload: async (title, file) => {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("file", file);
      return request("/api/guidelines/upload", { method: "POST", body: formData });
    },
    extractRules: async (id) => request(`/api/guidelines/${id}/extract-rules`, { method: "POST" }),
    approveRules: async (id, rules) => request(`/api/guidelines/${id}/approve-rules`, { method: "POST", body: JSON.stringify({ rules }) }),
  },

  // Submissions & Review Workflow
  submissions: {
    list: async () => {
      try {
        return await request("/api/submissions");
      } catch {
        const { mockSubmissions } = await import("./mockData.js");
        return mockSubmissions;
      }
    },
    get: async (id) => {
      try {
        return await request(`/api/submissions/${id}`);
      } catch {
        const { mockSubmissions } = await import("./mockData.js");
        return mockSubmissions.find(s => s.id === Number(id)) || mockSubmissions[0];
      }
    },
    create: async (data) => request("/api/submissions", { method: "POST", body: JSON.stringify(data) }),
    update: async (id, data) => request(`/api/submissions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    getVersions: async (id) => request(`/api/submissions/${id}/versions`),
    check: async (id) => request(`/api/submissions/${id}/check`, { method: "POST" }),
    submit: async (id) => request(`/api/submissions/${id}/submit`, { method: "POST" }),
    review: async (id, data) => request(`/api/submissions/${id}/review`, { method: "POST", body: JSON.stringify(data) }),
  },

  // Findings
  findings: {
    updateDecision: async (id, decision, justification = null) =>
      request(`/api/findings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, justification }),
      }),
  },

  // Audit
  audit: {
    list: async (limit = 50, offset = 0) => request(`/api/audit?limit=${limit}&offset=${offset}`),
  },

  // Analytics
  analytics: {
    getSummary: async () => request("/api/analytics/summary"),
  },
};
