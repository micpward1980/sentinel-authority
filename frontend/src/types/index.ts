// Sentinel Authority Platform Types

export type AccountType = 
  | 'applicant' 
  | 'certified_operator' 
  | 'licensed_implementer' 
  | 'insurer' 
  | 'regulator';

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'terminated';

export type CertificationState = 
  | 'observe' 
  | 'bounded' 
  | 'certified' 
  | 'suspended' 
  | 'revoked';

export type CAT72Status = 
  | 'scheduled' 
  | 'initializing' 
  | 'in_progress' 
  | 'passed' 
  | 'failed' 
  | 'aborted';

export type EventSeverity = 'info' | 'warning' | 'violation' | 'critical' | 'breach';

export type ODDClass = 
  | 'indoor_logistics'
  | 'outdoor_logistics'
  | 'highway_l4'
  | 'urban_l3'
  | 'urban_l4'
  | 'industrial_fixed'
  | 'industrial_mobile'
  | 'aerial_confined'
  | 'aerial_beyond_visual'
  | 'marine_coastal'
  | 'marine_open'
  | 'custom';

export interface Account {
  id: string;
  account_number: string;
  name: string;
  legal_name?: string;
  account_type: AccountType;
  status: AccountStatus;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  billing_email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country: string;
  billing_tier: string;
  notes?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountSummary {
  id: string;
  account_number: string;
  name: string;
  account_type: AccountType;
  status: AccountStatus;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface System {
  id: string;
  system_number: string;
  account_id: string;
  name: string;
  description?: string;
  version?: string;
  odd_class: ODDClass;
  odd_class_custom?: string;
  certification_state: CertificationState;
  certification_state_changed_at: string;
  current_envelope_id?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SystemSummary {
  id: string;
  system_number: string;
  name: string;
  odd_class: ODDClass;
  certification_state: CertificationState;
}

export interface Envelope {
  id: string;
  system_id: string;
  version: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  specification: Record<string, unknown>;
  velocity_max_mps?: number;
  acceleration_max_mps2?: number;
  angular_velocity_max_radps?: number;
  position_bounds?: Record<string, unknown>;
  temperature_min_c?: number;
  temperature_max_c?: number;
  wind_speed_max_mps?: number;
  visibility_min_m?: number;
  max_decisions_per_second?: number;
  max_actuations_per_second?: number;
  invariants: unknown[];
  is_approved: boolean;
  approved_at?: string;
  specification_hash?: string;
  notes?: string;
  created_at: string;
}

export interface CAT72Test {
  id: string;
  test_number: string;
  system_id: string;
  envelope_id: string;
  account_id: string;
  status: CAT72Status;
  scheduled_start_at: string;
  actual_start_at?: string;
  actual_end_at?: string;
  required_duration_hours: number;
  elapsed_hours: number;
  total_events: number;
  violation_count: number;
  intervention_count: number;
  envelope_breach_count: number;
  max_violations_allowed: number;
  max_interventions_allowed: number;
  max_breaches_allowed: number;
  environment?: string;
  test_location?: string;
  test_conditions: Record<string, unknown>;
  result_summary?: string;
  result_data?: Record<string, unknown>;
  fail_closed_verified?: boolean;
  regimes_tested?: string[];
  evidence_package_url?: string;
  evidence_hash?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CAT72Event {
  id: string;
  test_id: string;
  event_time: string;
  event_type: string;
  severity: EventSeverity;
  message?: string;
  data?: Record<string, unknown>;
  position_lat?: number;
  position_lon?: number;
  position_alt_m?: number;
  velocity_mps?: number;
  heading_deg?: number;
  envelope_evaluation?: Record<string, unknown>;
  constraint_violated?: string;
  interlock_triggered: boolean;
  interlock_action?: string;
  created_at: string;
}

export interface ConformanceRecord {
  id: string;
  record_number: string;
  system_id: string;
  envelope_id: string;
  account_id: string;
  cat72_test_id?: string;
  certification_state: CertificationState;
  odd_class: ODDClass;
  issued_at: string;
  effective_at: string;
  expires_at: string;
  is_revoked: boolean;
  revoked_at?: string;
  revocation_reason?: string;
  record_hash: string;
  signature: string;
  signature_algorithm: string;
  signing_key_id?: string;
  previous_record_id?: string;
  notes?: string;
  created_at: string;
}

export interface Task {
  id: string;
  account_id: string;
  title: string;
  description?: string;
  task_type?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  system_id?: string;
  conformance_record_id?: string;
  assigned_to?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  due_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface DashboardMetrics {
  total_accounts: number;
  active_accounts: number;
  total_systems: number;
  certified_systems: number;
  bounded_systems: number;
  observe_systems: number;
  active_cat72_tests: number;
  passed_cat72_tests_30d: number;
  failed_cat72_tests_30d: number;
  expiring_certifications_30d: number;
}

export interface VerificationResponse {
  is_valid: boolean;
  record_number?: string;
  certification_state?: CertificationState;
  system_name?: string;
  account_name?: string;
  odd_class?: ODDClass;
  issued_at?: string;
  expires_at?: string;
  is_revoked: boolean;
  revocation_reason?: string;
  verification_timestamp: string;
  message: string;
}

// Form types
export interface AccountCreateInput {
  name: string;
  legal_name?: string;
  account_type: AccountType;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  billing_email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
}

export interface SystemCreateInput {
  name: string;
  description?: string;
  version?: string;
  odd_class: ODDClass;
  odd_class_custom?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
}

export interface CAT72CreateInput {
  system_id: string;
  envelope_id: string;
  scheduled_start_at: string;
  required_duration_hours?: number;
  max_violations_allowed?: number;
  max_interventions_allowed?: number;
  max_breaches_allowed?: number;
  environment?: string;
  test_location?: string;
  notes?: string;
}
