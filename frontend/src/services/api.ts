import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Account,
  AccountSummary,
  AccountCreateInput,
  System,
  SystemSummary,
  SystemCreateInput,
  Envelope,
  CAT72Test,
  CAT72Event,
  CAT72CreateInput,
  ConformanceRecord,
  Task,
  User,
  PaginatedResponse,
  VerificationResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add error interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string): Promise<{ access_token: string }> {
    const { data } = await this.client.post('/auth/token', { email, password });
    return data;
  }

  async getCurrentUser(): Promise<User> {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  // Accounts
  async getAccounts(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    type?: string;
    search?: string;
  }): Promise<PaginatedResponse<AccountSummary>> {
    const { data } = await this.client.get('/accounts', { params });
    return data;
  }

  async getAccount(id: string): Promise<Account> {
    const { data } = await this.client.get(`/accounts/${id}`);
    return data;
  }

  async createAccount(input: AccountCreateInput): Promise<Account> {
    const { data } = await this.client.post('/accounts', input);
    return data;
  }

  async updateAccount(id: string, input: Partial<AccountCreateInput>): Promise<Account> {
    const { data } = await this.client.patch(`/accounts/${id}`, input);
    return data;
  }

  async getAccountUsers(accountId: string): Promise<User[]> {
    const { data } = await this.client.get(`/accounts/${accountId}/users`);
    return data;
  }

  async getAccountStats(accountId: string): Promise<Record<string, unknown>> {
    const { data } = await this.client.get(`/accounts/${accountId}/stats`);
    return data;
  }

  // Systems
  async getSystems(params?: {
    page?: number;
    per_page?: number;
    account_id?: string;
    certification_state?: string;
    odd_class?: string;
    search?: string;
  }): Promise<PaginatedResponse<SystemSummary>> {
    const { data } = await this.client.get('/systems', { params });
    return data;
  }

  async getSystem(id: string): Promise<System> {
    const { data } = await this.client.get(`/systems/${id}`);
    return data;
  }

  async createSystem(input: SystemCreateInput, accountId?: string): Promise<System> {
    const { data } = await this.client.post('/systems', input, {
      params: accountId ? { account_id: accountId } : undefined,
    });
    return data;
  }

  async updateSystem(id: string, input: Partial<SystemCreateInput>): Promise<System> {
    const { data } = await this.client.patch(`/systems/${id}`, input);
    return data;
  }

  async updateSystemState(id: string, newState: string): Promise<System> {
    const { data } = await this.client.post(`/systems/${id}/state`, null, {
      params: { new_state: newState },
    });
    return data;
  }

  async getSystemEnvelopes(systemId: string): Promise<Envelope[]> {
    const { data } = await this.client.get(`/systems/${systemId}/envelopes`);
    return data;
  }

  // Envelopes
  async getEnvelopes(params?: {
    page?: number;
    per_page?: number;
    system_id?: string;
    is_approved?: boolean;
  }): Promise<PaginatedResponse<Envelope>> {
    const { data } = await this.client.get('/envelopes', { params });
    return data;
  }

  async getEnvelope(id: string): Promise<Envelope> {
    const { data } = await this.client.get(`/envelopes/${id}`);
    return data;
  }

  async createEnvelope(systemId: string, input: Record<string, unknown>): Promise<Envelope> {
    const { data } = await this.client.post('/envelopes', input, {
      params: { system_id: systemId },
    });
    return data;
  }

  async approveEnvelope(id: string): Promise<Envelope> {
    const { data } = await this.client.post(`/envelopes/${id}/approve`);
    return data;
  }

  async setCurrentEnvelope(id: string): Promise<Envelope> {
    const { data } = await this.client.post(`/envelopes/${id}/set-current`);
    return data;
  }

  // CAT-72 Tests
  async getCAT72Tests(params?: {
    page?: number;
    per_page?: number;
    account_id?: string;
    system_id?: string;
    status?: string;
  }): Promise<PaginatedResponse<CAT72Test>> {
    const { data } = await this.client.get('/cat72', { params });
    return data;
  }

  async getCAT72Test(id: string): Promise<CAT72Test> {
    const { data } = await this.client.get(`/cat72/${id}`);
    return data;
  }

  async scheduleCAT72Test(input: CAT72CreateInput): Promise<CAT72Test> {
    const { data } = await this.client.post('/cat72', input);
    return data;
  }

  async startCAT72Test(id: string): Promise<CAT72Test> {
    const { data } = await this.client.post(`/cat72/${id}/start`);
    return data;
  }

  async completeCAT72Test(id: string): Promise<CAT72Test> {
    const { data } = await this.client.post(`/cat72/${id}/complete`);
    return data;
  }

  async getCAT72Events(testId: string, params?: {
    severity?: string;
    limit?: number;
  }): Promise<CAT72Event[]> {
    const { data } = await this.client.get(`/cat72/${testId}/events`, { params });
    return data;
  }

  async ingestCAT72Event(testId: string, event: Record<string, unknown>): Promise<CAT72Event> {
    const { data } = await this.client.post(`/cat72/${testId}/events`, event);
    return data;
  }

  // Conformance Records
  async getConformanceRecords(params?: {
    page?: number;
    per_page?: number;
    account_id?: string;
    system_id?: string;
    certification_state?: string;
    include_revoked?: boolean;
  }): Promise<PaginatedResponse<ConformanceRecord>> {
    const { data } = await this.client.get('/conformance', { params });
    return data;
  }

  async getConformanceRecord(id: string): Promise<ConformanceRecord> {
    const { data } = await this.client.get(`/conformance/${id}`);
    return data;
  }

  async issueConformanceRecord(input: Record<string, unknown>): Promise<ConformanceRecord> {
    const { data } = await this.client.post('/conformance', input);
    return data;
  }

  async revokeConformanceRecord(id: string, reason: string): Promise<ConformanceRecord> {
    const { data } = await this.client.post(`/conformance/${id}/revoke`, null, {
      params: { reason },
    });
    return data;
  }

  async getExpiringRecords(days?: number): Promise<ConformanceRecord[]> {
    const { data } = await this.client.get('/conformance/expiring/soon', {
      params: { days },
    });
    return data;
  }

  // Public Verification (no auth required)
  async verifyRecord(recordId?: string, recordHash?: string): Promise<VerificationResponse> {
    const { data } = await axios.post(`${API_BASE_URL}/verify`, {
      record_id: recordId,
      record_hash: recordHash,
    });
    return data;
  }

  async verifyByNumber(recordNumber: string): Promise<Record<string, unknown>> {
    const { data } = await axios.get(`${API_BASE_URL}/verify/${recordNumber}`);
    return data;
  }

  // Tasks
  async getTasks(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    priority?: string;
    assigned_to?: string;
  }): Promise<PaginatedResponse<Task>> {
    const { data } = await this.client.get('/tasks', { params });
    return data;
  }

  async getTask(id: string): Promise<Task> {
    const { data } = await this.client.get(`/tasks/${id}`);
    return data;
  }

  async createTask(input: Record<string, unknown>): Promise<Task> {
    const { data } = await this.client.post('/tasks', input);
    return data;
  }

  async updateTask(id: string, input: Record<string, unknown>): Promise<Task> {
    const { data } = await this.client.patch(`/tasks/${id}`, input);
    return data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/tasks/${id}`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const { data } = await axios.get(`${API_BASE_URL}/health`);
    return data;
  }
}

export const api = new ApiService();
export default api;
