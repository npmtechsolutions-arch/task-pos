import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore, useUIStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LayoutDashboard } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export function AdminDashboard() {
    const { user } = useAuthStore();
    const { addToast } = useUIStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [heroData, setHeroData] = useState({
        headline: '',
        sub_headline: '',
        cta_text: '',
        cta_link: '',
    });

    useEffect(() => {
        fetchLandingContent();
    }, []);

    const fetchLandingContent = async () => {
        try {
            const response = await axios.get(`${API_URL}/landing/content`);
            if (response.data && response.data.hero) {
                setHeroData({
                    headline: response.data.hero.headline || '',
                    sub_headline: response.data.hero.sub_headline || '',
                    cta_text: response.data.hero.cta_text || '',
                    cta_link: response.data.hero.cta_link || '',
                });
            }
        } catch (error) {
            console.error("Failed to fetch landing content:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveHero = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `${API_URL}/admin/landing/hero`,
                heroData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            addToast({
                type: 'success',
                title: 'Success',
                message: 'Hero section updated successfully!',
            });
        } catch (error) {
            console.error("Failed to save hero content:", error);
            addToast({
                type: 'error',
                title: 'Error',
                message: 'Failed to save changes. Make sure you are an admin.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (user?.role !== 'owner' && user?.role !== 'admin') {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                <p>You must be an admin to view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                    <LayoutDashboard className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Landing Page Admin</h1>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <Card className="shadow-md">
                    <CardHeader className="bg-gray-50 border-b border-gray-100">
                        <CardTitle className="text-xl">Hero Section</CardTitle>
                        <CardDescription>Edit the main headline and call-to-action on the landing page.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSaveHero} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="headline">Headline</Label>
                                <Input
                                    id="headline"
                                    value={heroData.headline}
                                    onChange={(e) => setHeroData({ ...heroData, headline: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sub_headline">Sub-headline</Label>
                                <Input
                                    id="sub_headline"
                                    value={heroData.sub_headline}
                                    onChange={(e) => setHeroData({ ...heroData, sub_headline: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cta_text">CTA Button Text</Label>
                                    <Input
                                        id="cta_text"
                                        value={heroData.cta_text}
                                        onChange={(e) => setHeroData({ ...heroData, cta_text: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cta_link">CTA Button Link</Label>
                                    <Input
                                        id="cta_link"
                                        value={heroData.cta_link}
                                        onChange={(e) => setHeroData({ ...heroData, cta_link: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
