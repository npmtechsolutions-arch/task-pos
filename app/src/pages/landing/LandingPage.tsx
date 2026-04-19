import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLandingContent } from '@/api/landing';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import {
    Moon, Sun, Monitor, Activity, Users, ShieldCheck, CheckCircle2,
    ChevronRight, CheckSquare, Kanban, Clock, Shield, Star, MapPin,
    Mail, Phone, Zap, BarChart3, MessageSquare, ArrowRight
} from 'lucide-react';

// ── Static fallback content (shown when API is loading or fails) ──────────
const STATIC_CONTENT = {
    navbar: { brand_name: 'ProjectFlow', cta_text: 'Get Started', cta_link: '/login' },
    hero: {
        headline: 'Manage Projects.\nTrack Tasks.\nScale Your Team.',
        sub_headline: 'ProjectFlow helps teams collaborate in real-time, manage workloads efficiently, and deliver projects faster — all in one unified platform.',
        cta_text: 'Get Started Free',
        cta_link: '/login',
        secondary_cta_text: 'Book a Demo',
        secondary_cta_link: '/login',
    },
    about: {
        title: 'Built for Modern Teams Who Move Fast',
        description: 'ProjectFlow combines the simplicity of a task manager with the power of enterprise project management — giving every team member exactly what they need.',
        points: JSON.stringify([
            'Real-time collaboration across teams and time zones',
            'Role-based access control for complete security',
            'Advanced analytics to improve team performance',
            'Kanban, List & Timeline views in one place',
        ]),
    },
    features: [
        { icon_name: 'activity', title: 'Project Management', description: 'Plan, track, and deliver projects with full visibility. Never miss a deadline again.' },
        { icon_name: 'check-square', title: 'Task Tracking', description: 'Assign tasks, monitor progress, and meet deadlines with intelligent notifications.' },
        { icon_name: 'kanban', title: 'Kanban Boards', description: 'Visualize your entire workflow and improve team productivity with drag-and-drop boards.' },
        { icon_name: 'message', title: 'Real-Time Collaboration', description: 'Comments, mentions, file attachments, and instant updates keep everyone aligned.' },
        { icon_name: 'pie-chart', title: 'Analytics & Reports', description: 'Track team performance with powerful dashboards and exportable reports.' },
        { icon_name: 'users', title: 'Team Management', description: 'Organize teams, assign roles, and manage permissions with fine-grained access control.' },
    ],
    steps: [
        { step_number: '01', title: 'Create Your Workspace', description: 'Sign up and set up your organization workspace in under 2 minutes.' },
        { step_number: '02', title: 'Invite Your Team', description: 'Add team members and assign roles. Everyone gets the right level of access automatically.' },
        { step_number: '03', title: 'Launch Projects', description: 'Create projects, assign tasks, set deadlines, and track everything in real time.' },
    ],
    testimonials: [
        { content: 'ProjectFlow transformed how our team works. We shipped 40% faster after adopting it.', author_name: 'Sarah Chen', author_role: 'Engineering Lead', author_company: 'TechStartup Inc.', rating: 5, avatar_url: 'https://i.pravatar.cc/48?img=1' },
        { content: 'The Kanban boards and reporting features are exactly what we needed to scale.', author_name: 'Marcus Johnson', author_role: 'Product Manager', author_company: 'ScaleUp Corp', rating: 5, avatar_url: 'https://i.pravatar.cc/48?img=3' },
        { content: 'Best project management tool we\'ve used. The UI is clean and the features are powerful.', author_name: 'Priya Patel', author_role: 'CTO', author_company: 'Innovation Labs', rating: 5, avatar_url: 'https://i.pravatar.cc/48?img=5' },
        { content: 'Onboarding was seamless. Our team was productive from day one.', author_name: 'David Kim', author_role: 'Operations Director', author_company: 'Global Ventures', rating: 5, avatar_url: 'https://i.pravatar.cc/48?img=7' },
    ],
    cta: {
        title: 'Start Managing Your Work Smarter Today',
        description: 'Join thousands of teams who already ship faster, collaborate better, and deliver results with ProjectFlow.',
        button_text: 'Start Free Trial',
        button_link: '/login',
    },
    contact: {
        title: 'Get in Touch',
        description: 'Have questions? Our team is happy to help you get started.',
        email: 'support@projectflow.com',
        phone: '+1 (800) 123-4567',
        address: '123 Tech Street, San Francisco, CA 94105',
    },
    footer: [
        { name: 'Product', links: [{ title: 'Features', url: '#features' }, { title: 'Pricing', url: '#pricing' }, { title: 'Changelog', url: '#' }] },
        { name: 'Company', links: [{ title: 'About', url: '#about' }, { title: 'Blog', url: '#' }, { title: 'Careers', url: '#' }] },
        { name: 'Legal', links: [{ title: 'Privacy Policy', url: '#' }, { title: 'Terms of Service', url: '#' }, { title: 'Security', url: '#' }] },
    ],
};

export const LandingPage = () => {
    const navigate = useNavigate();
    const { data: apiContent } = useLandingContent();
    const { theme, setTheme } = useUIStore();
    const [activeUsers, setActiveUsers] = useState(1242);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveUsers(prev => prev + Math.floor(Math.random() * 7) - 2);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    const toggleTheme = () => {
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('system');
        else setTheme('light');
    };

    // Merge API content with static fallbacks — API wins when available
    const content: any = {
        navbar:       apiContent?.navbar       || STATIC_CONTENT.navbar,
        hero:         apiContent?.hero         || STATIC_CONTENT.hero,
        about:        apiContent?.about        || STATIC_CONTENT.about,
        features:     (apiContent?.features?.length ? apiContent.features : STATIC_CONTENT.features),
        steps:        (apiContent?.steps?.length    ? apiContent.steps    : STATIC_CONTENT.steps),
        testimonials: (apiContent?.testimonials?.length ? apiContent.testimonials : STATIC_CONTENT.testimonials),
        cta:          apiContent?.cta          || STATIC_CONTENT.cta,
        contact:      apiContent?.contact      || STATIC_CONTENT.contact,
        footer:       (apiContent?.footer?.length ? apiContent.footer : STATIC_CONTENT.footer),
        pricing:      apiContent?.pricing      || [],
    };

    const { navbar, hero, about, features, steps, testimonials, cta, contact, footer, pricing } = content;

    const renderIcon = (name: string) => {
        switch (name?.toLowerCase()) {
            case 'users':        return <Users className="w-6 h-6" />;
            case 'activity':     return <Activity className="w-6 h-6" />;
            case 'check-square': return <CheckSquare className="w-6 h-6" />;
            case 'pie-chart':    return <BarChart3 className="w-6 h-6" />;
            case 'bell':         return <Clock className="w-6 h-6" />;
            case 'kanban':       return <Kanban className="w-6 h-6" />;
            case 'clock':        return <Clock className="w-6 h-6" />;
            case 'shield':       return <Shield className="w-6 h-6" />;
            case 'message':      return <MessageSquare className="w-6 h-6" />;
            case 'zap':          return <Zap className="w-6 h-6" />;
            default:             return <CheckCircle2 className="w-6 h-6" />;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary/20">

            {/* ── 1. Navbar ───────────────────────────────────────────── */}
            <nav className="border-b border-border/40 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                            {navbar?.brand_name?.charAt(0) || 'P'}
                        </div>
                        <span className="font-bold text-xl tracking-tight">{navbar?.brand_name || 'ProjectFlow'}</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground mr-4">
                            <a href="#features" className="hover:text-primary transition-colors">Features</a>
                            <a href="#about" className="hover:text-primary transition-colors">About</a>
                            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
                        </div>
                        <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">Log In</Link>
                        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
                            {theme === 'light' ? <Sun className="h-5 w-5" /> : theme === 'dark' ? <Moon className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                        </Button>
                        <Button className="hidden sm:inline-flex rounded-full" onClick={() => navigate('/login')}>
                            {navbar?.cta_text || 'Get Started'}
                        </Button>
                    </div>
                </div>
            </nav>

            <main className="flex-1">

                {/* ── 2. Hero Section ─────────────────────────────────── */}
                <section className="relative overflow-hidden py-24 lg:py-32">
                    <div className="absolute inset-0 bg-primary/5 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
                    <div className="container mx-auto px-4 relative">
                        <div className="max-w-4xl mx-auto text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-8">
                                <Zap className="w-4 h-4" />
                                Enterprise-grade project management — now for everyone
                            </div>
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] whitespace-pre-line">
                                {hero?.headline || 'Manage Projects.\nTrack Tasks.\nScale Your Team.'}
                            </h1>
                            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                                {hero?.sub_headline || 'ProjectFlow helps teams collaborate in real-time, manage workloads efficiently, and deliver projects faster — all in one unified platform.'}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Button
                                    id="hero-get-started-btn"
                                    size="lg"
                                    className="h-14 px-8 text-base shadow-lg hover:shadow-primary/25 hover:-translate-y-1 transition-all rounded-full"
                                    onClick={() => navigate(hero?.cta_link || '/login')}
                                >
                                    {hero?.cta_text || 'Get Started Free'}
                                    <ChevronRight className="ml-2 w-4 h-4" />
                                </Button>
                                <Button
                                    id="hero-demo-btn"
                                    size="lg"
                                    variant="outline"
                                    className="h-14 px-8 text-base rounded-full"
                                    onClick={() => navigate(hero?.secondary_cta_link || '/login')}
                                >
                                    {hero?.secondary_cta_text || 'Book a Demo'}
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Kanban Preview UI */}
                        <div className="mt-20 relative mx-auto max-w-5xl rounded-2xl border border-border/50 bg-card/50 backdrop-blur p-2 shadow-2xl ring-1 ring-border/50">
                            <div className="rounded-xl overflow-hidden border border-border/50 bg-background">
                                <div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-muted/30">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-400" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                        <div className="w-3 h-3 rounded-full bg-green-400" />
                                    </div>
                                    <div className="flex-1 mx-4 h-6 bg-muted/50 rounded-md" />
                                </div>
                                <div className="p-6 grid grid-cols-3 gap-6 h-[380px]">
                                    {[
                                        { label: 'Backlog', color: 'bg-slate-400', cards: ['Design system audit', 'API rate limiting'] },
                                        { label: 'In Progress', color: 'bg-amber-400', cards: ['Auth module', 'Kanban drag-drop'] },
                                        { label: 'Done', color: 'bg-emerald-400', cards: ['CI/CD pipeline', 'DB schema v2'] },
                                    ].map((col, ci) => (
                                        <div key={ci} className="bg-muted/30 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                                            </div>
                                            {col.cards.map((card, cardI) => (
                                                <div key={cardI} className="bg-card rounded-lg shadow-sm p-3 border border-border/50 hover:-translate-y-0.5 transition-transform cursor-pointer">
                                                    <div className="text-sm font-medium mb-2">{card}</div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-primary/20" />
                                                        <div className="h-2 w-16 bg-muted rounded" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Stats Bar ───────────────────────────────────────── */}
                <section className="py-12 border-y border-border/50 bg-muted/20">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24 text-center">
                            <div className="flex flex-col items-center space-y-2">
                                <div className="flex items-center gap-2 text-primary font-bold text-3xl tracking-tight">
                                    {activeUsers.toLocaleString()}+
                                </div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Users</p>
                            </div>
                            <div className="flex flex-col items-center space-y-2">
                                <div className="text-3xl font-bold tracking-tight text-foreground">50K+</div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Projects Managed</p>
                            </div>
                            <div className="flex flex-col items-center space-y-2">
                                <div className="text-3xl font-bold tracking-tight text-foreground">99.9%</div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Uptime SLA</p>
                            </div>
                            <div className="flex flex-col items-center space-y-2">
                                <div className="flex items-center gap-1.5 text-sm font-medium bg-background px-4 py-2 border border-border rounded-full shadow-sm">
                                    <ShieldCheck className="w-5 h-5 text-primary" /> Enterprise Secured
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 3. About Section ────────────────────────────────── */}
                <section id="about" className="py-24 bg-background">
                    <div className="container mx-auto px-4 relative">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
                                    {about.title}
                                </h2>
                                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                    {about.description}
                                </p>
                                <div className="space-y-4">
                                    {JSON.parse(about.points).map((point: string, i: number) => (
                                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                                            <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                                            <span className="font-medium">{point}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="relative h-[500px] rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-border/50 p-8 shadow-2xl flex items-center justify-center overflow-hidden">
                                <div className="absolute w-48 h-48 bg-primary/20 rounded-full blur-2xl top-10 right-10" />
                                <div className="absolute w-64 h-64 bg-background/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl transform rotate-12 flex items-center justify-center">
                                    <Kanban className="w-24 h-24 text-primary opacity-80" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 4. How It Works ─────────────────────────────────── */}
                <section className="py-24 bg-muted/30 border-y border-border/50">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Get Started in Minutes</h2>
                        <p className="text-lg text-muted-foreground mb-16 max-w-xl mx-auto">No complex setup. No lengthy onboarding. Just sign up and start managing work.</p>
                        <div className="grid md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
                            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border z-0" />
                            {steps.map((step: any, i: number) => (
                                <div key={i} className="relative z-10 flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full bg-background border-4 border-card flex items-center justify-center text-2xl font-black text-primary mb-6 shadow-xl ring-1 ring-border/50">
                                        {step.step_number}
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-muted-foreground">{step.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 5. Features ─────────────────────────────────────── */}
                <section id="features" className="py-24 bg-background relative">
                    <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
                    <div className="container mx-auto px-4 relative">
                        <div className="text-center mb-16 max-w-2xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Everything You Need to Manage Work Efficiently</h2>
                            <p className="text-lg text-muted-foreground">All the tools your team needs to plan, execute, and deliver projects — in one powerful platform.</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {features.map((f: any, i: number) => (
                                <div key={i} className="p-8 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 group">
                                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                                        {renderIcon(f.icon_name)}
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                                    <p className="text-muted-foreground leading-relaxed">{f.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 6. Pricing (dynamic only) ───────────────────────── */}
                {pricing && pricing.length > 0 && (
                    <section id="pricing" className="py-24 bg-muted/20 border-t border-border/50">
                        <div className="container mx-auto px-4">
                            <div className="text-center mb-16 max-w-2xl mx-auto">
                                <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Simple Pricing Plans</h2>
                                <p className="text-lg text-muted-foreground">Transparent pricing designed to scale with your team.</p>
                            </div>
                            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                                {pricing.map((tier: any, i: number) => (
                                    <div key={i} className={`relative flex flex-col p-8 rounded-3xl border bg-card shadow-lg transition-transform hover:-translate-y-2 ${tier.is_popular ? 'border-primary ring-2 ring-primary/20' : 'border-border/50'}`}>
                                        {tier.is_popular && (
                                            <div className="absolute -top-4 left-0 right-0 mx-auto w-fit px-4 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground bg-primary rounded-full shadow-lg">Most Popular</div>
                                        )}
                                        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                                        <div className="mb-6"><span className="text-5xl font-extrabold">{tier.description}</span></div>
                                        <ul className="space-y-4 mb-8 flex-1">
                                            {tier.features?.map((f: any, j: number) => (
                                                <li key={j} className="flex items-center gap-3 text-sm">
                                                    <CheckCircle2 className="w-5 h-5 shrink-0 text-primary" />
                                                    <span className="font-medium">{f.feature_name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <Button className="w-full h-12 text-base rounded-full" variant={tier.is_popular ? 'default' : 'outline'} onClick={() => navigate('/login')}>
                                            {tier.cta_text || 'Select Plan'}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── 7. Testimonials ─────────────────────────────────── */}
                <section className="py-24 bg-muted/10 border-t border-border/50">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">What Our Users Say</h2>
                            <p className="text-lg text-muted-foreground mt-4">Trusted by teams at companies of all sizes.</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                            {testimonials.map((t: any, i: number) => (
                                <div key={i} className="p-8 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-lg transition-shadow">
                                    <div className="flex text-yellow-500 mb-6">
                                        {[...Array(t.rating || 5)].map((_, j) => <Star key={j} className="w-5 h-5 fill-current" />)}
                                    </div>
                                    <p className="text-lg italic text-foreground mb-8 leading-relaxed">"{t.content}"</p>
                                    <div className="flex items-center gap-4">
                                        <img src={t.avatar_url} alt={t.author_name} className="w-12 h-12 rounded-full border border-border object-cover" />
                                        <div>
                                            <div className="font-bold">{t.author_name}</div>
                                            <div className="text-sm text-muted-foreground">{t.author_role} – {t.author_company}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 8. CTA Section ──────────────────────────────────── */}
                <section className="py-32 bg-primary relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:4rem_4rem]" />
                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-primary-foreground">
                                {cta.title}
                            </h2>
                            <p className="text-xl text-primary-foreground/80 mb-10 leading-relaxed">
                                {cta.description}
                            </p>
                            <Button
                                id="cta-free-trial-btn"
                                size="lg"
                                variant="secondary"
                                className="h-16 px-10 text-lg rounded-full shadow-2xl hover:scale-105 transition-transform"
                                onClick={() => navigate(cta.button_link || '/login')}
                            >
                                {cta.button_text || 'Start Free Trial'}
                                <ChevronRight className="ml-2 w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </section>

                {/* ── 9. Contact ──────────────────────────────────────── */}
                <section id="contact" className="py-24 bg-background border-t border-border/50">
                    <div className="container mx-auto px-4">
                        <div className="max-w-3xl mx-auto text-center">
                            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{contact.title}</h2>
                            <p className="text-lg text-muted-foreground mb-12">{contact.description}</p>
                            <div className="grid md:grid-cols-3 gap-8">
                                <div className="flex flex-col items-center p-6 border border-border/50 rounded-2xl bg-muted/20">
                                    <Mail className="w-8 h-8 text-primary mb-4" />
                                    <h4 className="font-bold mb-2">Email</h4>
                                    <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary transition-colors text-sm">{contact.email}</a>
                                </div>
                                <div className="flex flex-col items-center p-6 border border-border/50 rounded-2xl bg-muted/20">
                                    <Phone className="w-8 h-8 text-primary mb-4" />
                                    <h4 className="font-bold mb-2">Phone</h4>
                                    <span className="text-muted-foreground text-sm">{contact.phone}</span>
                                </div>
                                <div className="flex flex-col items-center p-6 border border-border/50 rounded-2xl bg-muted/20">
                                    <MapPin className="w-8 h-8 text-primary mb-4" />
                                    <h4 className="font-bold mb-2">Address</h4>
                                    <span className="text-muted-foreground text-center text-sm">{contact.address}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── 10. Footer ──────────────────────────────────────────── */}
            <footer className="border-t border-border/50 bg-card py-16">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-12 border-b border-border/50 pb-12 mb-8">
                        <div className="md:col-span-1">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                    {navbar?.brand_name?.charAt(0) || 'P'}
                                </div>
                                <span className="font-bold text-xl">{navbar?.brand_name || 'ProjectFlow'}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                A powerful project management platform designed to help teams organize work, collaborate efficiently, and achieve success.
                            </p>
                            <Button className="mt-6 rounded-full" onClick={() => navigate('/login')}>
                                Get Started Free
                            </Button>
                        </div>
                        {footer.map((cat: any, i: number) => (
                            <div key={i} className="md:col-span-1">
                                <h4 className="font-bold mb-6 tracking-wide">{cat.name}</h4>
                                <ul className="space-y-4 text-sm text-muted-foreground">
                                    {cat.links?.map((link: any, j: number) => (
                                        <li key={j}><a href={link.url} className="hover:text-primary transition-colors">{link.title}</a></li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
                        <p>© {new Date().getFullYear()} {navbar?.brand_name || 'ProjectFlow'}. All Rights Reserved.</p>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            <span>All Systems Operational</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
