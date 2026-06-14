import axios from "axios";

// Use relative URLs when deployed (nginx proxies /api/ to backend)
// Use absolute URL for local development
const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
});

// Customers
export const getCustomers = (params?: Record<string, any>) =>
  api.get("/api/customers", { params }).then((r) => r.data);

export const getCustomer = (id: string) =>
  api.get(`/api/customers/${id}`).then((r) => r.data);

export const createCustomer = (data: any) =>
  api.post("/api/customers", data).then((r) => r.data);

export const getCities = () =>
  api.get("/api/customers/cities").then((r) => r.data);

export const updateCustomer = (id: string, data: any) =>
  api.patch(`/api/customers/${id}`, data).then((r) => r.data);

export const deleteCustomer = (id: string) =>
  api.delete(`/api/customers/${id}`);

export const exportCustomersCSV = (params?: Record<string, any>) =>
  api.get("/api/customers/export/csv", { params, responseType: "blob" }).then((r) => r.data);

// Orders
export const getOrders = (params?: Record<string, any>) =>
  api.get("/api/orders", { params }).then((r) => r.data);

export const getCategories = () =>
  api.get("/api/orders/categories").then((r) => r.data);

export const exportOrdersCSV = (params?: Record<string, any>) =>
  api.get("/api/orders/export/csv", { params, responseType: "blob" }).then((r) => r.data);

// Segments
export const getSegments = (params?: Record<string, any>) =>
  api.get("/api/segments", { params }).then((r) => r.data);

export const getSegment = (id: string) =>
  api.get(`/api/segments/${id}`).then((r) => r.data);

export const createSegmentFromNL = (data: { natural_language: string; name?: string }) =>
  api.post("/api/segments/from-nl", data).then((r) => r.data);

export const deleteSegment = (id: string) =>
  api.delete(`/api/segments/${id}`);

export const getSegmentCustomers = (id: string, params?: Record<string, any>) =>
  api.get(`/api/segments/${id}/customers`, { params }).then((r) => r.data);

// Campaigns
export const getCampaigns = (params?: Record<string, any>) =>
  api.get("/api/campaigns", { params }).then((r) => r.data);

export const getCampaign = (id: string) =>
  api.get(`/api/campaigns/${id}`).then((r) => r.data);

export const createCampaign = (data: any) =>
  api.post("/api/campaigns", data).then((r) => r.data);

export const generateCampaign = (data: { prompt: string; segment_id?: string }) =>
  api.post("/api/campaigns/generate", data).then((r) => r.data);

export const launchCampaign = (id: string) =>
  api.post(`/api/campaigns/${id}/launch`).then((r) => r.data);

export const getCampaignAnalytics = (id: string) =>
  api.get(`/api/campaigns/${id}/analytics`).then((r) => r.data);

export const deleteCampaign = (id: string) =>
  api.delete(`/api/campaigns/${id}`);

// Analytics
export const getDashboard = () =>
  api.get("/api/analytics/dashboard").then((r) => r.data);

export const getInsights = () =>
  api.get("/api/analytics/insights").then((r) => r.data);

export const getAnalyticsCampaigns = () =>
  api.get("/api/analytics/campaigns").then((r) => r.data);

export const getChannelAnalytics = () =>
  api.get("/api/analytics/channels").then((r) => r.data);

export const getRecentActivity = () =>
  api.get("/api/analytics/activity").then((r) => r.data);

export const getRevenueTrend = () =>
  api.get("/api/analytics/revenue-trend").then((r) => r.data);

// Bulk Import
export const bulkImportCustomers = (rows: any[]) =>
  api.post("/api/customers/bulk", { rows }).then((r) => r.data);

export const bulkImportOrders = (rows: any[]) =>
  api.post("/api/orders/bulk", { rows }).then((r) => r.data);

// AI Copilot
export const chatWithCopilot = (data: {
  message: string;
  conversation_history: { role: string; content: string }[];
  session_id?: string;
}) => api.post("/api/copilot", data).then((r) => r.data);
