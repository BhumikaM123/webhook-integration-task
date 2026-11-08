export interface KycWebhookPayload {
  event_id: string;
  investor_id: string;
  new_status: string;
  timestamp: string;
}

export interface JwtClaims {
  tenant_id: string;
  investor_id: string;
  sub?: string;
  iat?: number;
  exp?: number;
}

export interface KycStatusResponse {
  id: string;
  email: string;
  kyc_status: string;
  last_updated: string | null;
}

export interface KycJobData {
  eventId: string;
  investorId: string;
  newStatus: string;
  provider: string;
  payload: KycWebhookPayload;
}
