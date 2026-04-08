/**
 * API Client — wraps all backend endpoint calls.
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('claimguard_token');
  const headers: Record<string, string> = {
    ...(options?.headers || {}),
  };

  // Add auth header for non-auth endpoints
  if (token && !url.startsWith('/auth/')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// ── Upload ────────────────────────────────────────────────────────────

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<any>('/upload', { method: 'POST', body: formData });
}

export async function uploadBatch(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<any>('/upload-batch', { method: 'POST', body: formData });
}

// ── Fix ───────────────────────────────────────────────────────────────

export async function fixError(errorId: string, fixValue: string, rawContent: string) {
  return request<any>('/fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error_id: errorId, fix_value: fixValue, raw_content: rawContent }),
  });
}

export async function fixAll(rawContent: string) {
  return request<any>('/fix-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent }),
  });
}

// ── AI Chat ───────────────────────────────────────────────────────────

export async function chatWithAI(message: string, context?: string, history?: any[]) {
  return request<any>('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context, history: history || [] }),
  });
}

// ── NPI Validation ────────────────────────────────────────────────────

export async function validateNPI(npi: string) {
  return request<any>(`/validate-npi/${npi}`);
}

// ── Export ─────────────────────────────────────────────────────────────

export async function exportData(rawContent: string, format: string) {
  return request<any>('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent, format }),
  });
}

// ── Summaries ─────────────────────────────────────────────────────────

export async function getRemittanceSummary(rawContent: string) {
  return request<any>('/remittance-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent }),
  });
}

export async function getEnrollmentSummary(rawContent: string) {
  return request<any>('/enrollment-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_content: rawContent }),
  });
}

// ── Samples ───────────────────────────────────────────────────────────

export async function listSamples() {
  return request<any>('/samples');
}

export async function getSample(filename: string) {
  return request<any>(`/samples/${filename}`);
}

// ── Reference Data ────────────────────────────────────────────────────

export async function getCARCCodes() {
  return request<any>('/carc-codes');
}

export async function getRARCCodes() {
  return request<any>('/rarc-codes');
}

// ── Authentication ───────────────────────────────────────────────────

export async function registerUser(name: string, email: string, password: string) {
  return request<any>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}

export async function loginUser(email: string, password: string) {
  return request<any>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function getUserProfile() {
  return request<any>('/auth/me');
}
