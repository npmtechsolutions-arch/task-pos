import { create } from 'zustand';
import axios from 'axios';
import type { Timesheet } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TimeState {
  timesheets: Timesheet[];
  currentTimesheet: Timesheet | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchMyTimesheets: () => Promise<void>;
  logTime: (taskId: string, hours: number, description?: string) => Promise<void>;
  submitTimesheet: (timesheetId: string) => Promise<void>;
  approveTimesheet: (timesheetId: string) => Promise<void>;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  timesheets: [],
  currentTimesheet: null,
  isLoading: false,
  error: null,

  fetchMyTimesheets: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${API_URL}/timesheets`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const mappedTimesheets = response.data.map((s: any) => ({
        id: s.id,
        periodStart: s.period_start,
        periodEnd: s.period_end,
        status: s.status,
        totalHours: s.total_hours,
        billableHours: s.billable_hours
      }));
      set({ timesheets: mappedTimesheets, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch timesheets',
        isLoading: false
      });
    }
  },

  logTime: async (taskId, hours, description) => {
    set({ isLoading: true, error: null });
    try {
      await axios.post(`${API_URL}/tasks/${taskId}/log-time`, {
        hours,
        description
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      set({ isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to log time',
        isLoading: false
      });
      throw err;
    }
  },

  submitTimesheet: async (timesheetId) => {
    try {
      await axios.post(`${API_URL}/timesheets/${timesheetId}/submit`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      get().fetchMyTimesheets();
    } catch (err: any) {
      console.error("Failed to submit timesheet:", err);
    }
  },

  approveTimesheet: async (timesheetId) => {
    try {
      await axios.post(`${API_URL}/timesheets/${timesheetId}/approve`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      get().fetchMyTimesheets();
    } catch (err: any) {
      console.error("Failed to approve timesheet:", err);
    }
  },
}));
