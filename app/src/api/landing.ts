import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// Note: Ensure this matches the backend URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface LandingContent {
    navbar: any;
    hero: any;
    about: any;
    features: any[];
    steps: any[];
    badges: any[];
    pricing: any[];
    testimonials: any[];
    cta: any;
    contact: any;
    footer: any[];
}

export const useLandingContent = () => {
    return useQuery<LandingContent>({
        queryKey: ['landingContent'],
        queryFn: async () => {
            const response = await axios.get(`${API_URL}/landing/content`);
            return response.data;
        },
        staleTime: 1000 * 60 * 60, // 1 hour (content rarely changes)
    });
};

export const useSubmitLead = () => {
    return useMutation({
        mutationFn: async (data: { email: string; organization_name: string }) => {
            const response = await axios.post(`${API_URL}/onboarding/lead`, data);
            return response.data;
        },
    });
};
