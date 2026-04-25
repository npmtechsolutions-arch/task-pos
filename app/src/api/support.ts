/**
 * Support Ticket API Client
 * Connects directly to the FastAPI backend /api/v1/support endpoints
 */

import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/support`;

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender?: { id: string; first_name: string; last_name: string; full_name: string; avatar_url?: string };
  message: string;
  timestamp: string;
  attachments?: Record<string, unknown>;
}

export interface Ticket {
  id: string;
  ticket_id: string;
  tenant_id: string;
  title: string;
  description: string;
  category: 'bug' | 'feature' | 'performance' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
  created_by_id: string;
  created_by?: { id: string; first_name: string; last_name: string; full_name: string; avatar_url?: string };
  assigned_to_id?: string;
  assigned_to?: { id: string; full_name: string; avatar_url?: string };
  created_at: string;
  updated_at: string;
  messages?: TicketMessage[];
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: Ticket['category'];
  priority: Ticket['priority'];
}

export interface UpdateTicketPayload {
  status?: Ticket['status'];
  priority?: Ticket['priority'];
  assigned_to_id?: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Create a new ticket */
export async function createTicket(token: string, data: CreateTicketPayload): Promise<Ticket> {
  const res = await axios.post(BASE, data, { headers: authHeader(token) });
  return res.data;
}

/** Get the current user's tickets */
export async function getMyTickets(
  token: string,
  params?: { status?: string; page?: number; per_page?: number }
): Promise<TicketListResponse> {
  const res = await axios.get(`${BASE}/my`, {
    headers: authHeader(token),
    params,
  });
  return res.data;
}

/** Get ALL tickets (admin) with optional filters */
export async function getAllTickets(
  token: string,
  params?: { status?: string; priority?: string; category?: string; page?: number; per_page?: number }
): Promise<TicketListResponse> {
  const res = await axios.get(BASE, {
    headers: authHeader(token),
    params,
  });
  return res.data;
}

/** Get single ticket with messages */
export async function getTicket(token: string, ticketId: string): Promise<Ticket> {
  const res = await axios.get(`${BASE}/${ticketId}`, { headers: authHeader(token) });
  return res.data;
}

/** Update ticket status / priority (admin) */
export async function updateTicket(
  token: string,
  ticketId: string,
  data: UpdateTicketPayload
): Promise<Ticket> {
  const res = await axios.put(`${BASE}/${ticketId}`, data, { headers: authHeader(token) });
  return res.data;
}

/** Post a message to a ticket */
export async function sendMessage(
  token: string,
  ticketId: string,
  message: string
): Promise<TicketMessage> {
  const res = await axios.post(
    `${BASE}/${ticketId}/messages`,
    { ticket_id: ticketId, message },
    { headers: authHeader(token) }
  );
  return res.data;
}

/** Get all messages for a ticket */
export async function getMessages(token: string, ticketId: string): Promise<TicketMessage[]> {
  const res = await axios.get(`${BASE}/${ticketId}/messages`, { headers: authHeader(token) });
  return res.data;
}
