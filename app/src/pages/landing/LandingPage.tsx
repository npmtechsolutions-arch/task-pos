import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLandingContent } from '@/api/landing';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { Moon, Sun, Monitor, Activity, Users, ShieldCheck, CheckCircle2, ChevronRight, CheckSquare, Kanban, Clock, Shield, Star, MapPin, Mail, Phone } from 'lucide-react';

export const LandingPage = () => {
    const { data: content, isLoading } = useLandingContent();
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

    const _content: any = content || {
        navbar: { brand_name: 'TaskFlow', cta_text: 'Get Started', cta_link: '/register' },
        hero: { headline: 'Manage Work Effortlessly', sub_headline: 'The only project management tool you need to track tasks and deliver on time.', cta_text: 'Get Started Free', cta_link: '/register' }
    };

    if (isLoading && !content) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const { navbar, hero, about, features, steps, pricing, testimonials, cta, contact, footer } = _content;

    const renderIcon = (name: string) => {
        switch (name.toLowerCase()) {
            case 'users': return <Users className="w-6 h-6" />;
            case 'activity': return <Activity className="w-6 h-6" />;
            case 'check-square': return <CheckSquare className="w-6 h-6" />;
            case 'pie-chart': return <Activity className="w-6 h-6" />;
            case 'bell': return <Clock className="w-6 h-6" />;
            case 'kanban': return <Kanban className="w-6 h-6" />;
            case 'clock': return <Clock className="w-6 h-6" />;
            case 'shield': return <Shield className="w-6 h-6" />;
            default: return <CheckCircle2 className="w-6 h-6" />;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary/20">
            {/* 1. Navbar */}
            <nav className="border-b border-border/40 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                            {navbar?.brand_name?.charAt(0) || 'T'}
                        </div>
                        <span className="font-bold text-xl tracking-tight">{navbar?.brand_name || 'TaskManager'}</span>
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
                        <Button asChild className="hidden sm:inline-flex rounded-full">
                            <Link to={navbar?.cta_link || '/register'}>{navbar?.cta_text || 'Get Started'}</Link>
                        </Button>
                    </div>
                </div>
            </nav>

            <main className="flex-1">
                {/* 2. Hero Section */}
                <section className="relative overflow-hidden py-24 lg:py-32">
                    <div className="absolute inset-0 bg-primary/5 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
                    <div className="container mx-auto px-4 relative">
                        <div className="max-w-4xl mx-auto text-center">
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
                                {hero?.headline}
                            </h1>
                            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                                {hero?.sub_headline}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Button size="lg" className="h-14 px-8 text-base shadow-lg hover:shadow-primary/25 hover:-translate-y-1 transition-all rounded-full" asChild>
                                    <Link to={hero?.cta_link || '/register'}>{hero?.cta_text || 'Get Started Free'} <ChevronRight className="ml-2 w-4 h-4" /></Link>
                                </Button>
                                {hero?.secondary_cta_text && (
                                    <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-full" asChild>
                                        <Link to={hero?.secondary_cta_link || '/login'}>{hero?.secondary_cta_text}</Link>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Kanban Display UI */}
                        <div className="mt-20 relative mx-auto max-w-5xl rounded-2xl border border-border/50 bg-card/50 backdrop-blur p-2 shadow-2xl ring-1 ring-border/50 transform perspective-1000 rotate-x-2">
                            <div className="rounded-xl overflow-hidden border border-border/50 bg-background">
                                <div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-muted/30">
                                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
                                </div>
                                <div className="p-6 grid grid-cols-3 gap-6 opacity-90 h-[400px]">
                                    {[1, 2, 3].map((col) => (
                                        <div key={col} className="bg-muted/30 rounded-lg p-4 space-y-4">
                                            <div className="h-6 w-24 bg-muted animate-pulse rounded"></div>
                                            {[1, 2].map((card) => (
                                                <div key={card} className="h-24 bg-card rounded shadow-sm p-4 border border-border/50 hover:-translate-y-1 transition-transform">
                                                    <div className="h-4 w-3/4 bg-muted rounded mb-3"></div>
                                                    <div className="h-3 w-1/2 bg-muted/60 rounded"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Live Stats Bar */}
                <section className="py-12 border-y border-border/50 bg-muted/20">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24 text-center">
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="flex items-center gap-2 text-primary font-bold text-3xl tracking-tight">
                                    {activeUsers.toLocaleString()}+
                                </div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Users</p>
                            </div>
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="text-3xl font-bold tracking-tight text-foreground">99.9%</div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Uptime</p>
                            </div>
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="flex items-center gap-1.5 text-sm font-medium bg-background px-4 py-2 border border-border rounded-full shadow-sm">
                                    <ShieldCheck className="w-5 h-5 text-primary" /> Enterprise Secured
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. About Section */}
                {about && (
                    <section id="about" className="py-24 bg-background">
                        <div className="container mx-auto px-4 relative">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                            <div className="grid md:grid-cols-2 gap-16 items-center">
                                <div>
                                    <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">{about.title}</h2>
                                    <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                        {about.description}
                                    </p>
                                    {about.points && (
                                        <div className="space-y-4">
                                            {JSON.parse(about.points).map((point: string, i: number) => (
                                                <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                                                    <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                                                    <span className="font-medium">{point}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="relative h-[500px] rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-border/50 p-8 shadow-2xl flex items-center justify-center overflow-hidden">
                                    {/* Abstract Shapes */}
                                    <div className="absolute w-48 h-48 bg-primary/20 rounded-full blur-2xl top-10 right-10"></div>
                                    <div className="absolute w-64 h-64 bg-background/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl transform rotate-12 flex items-center justify-center">
                                        <Kanban className="w-24 h-24 text-primary opacity-80" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 4. Steps Section (How It Works) */}
                {steps && steps.length > 0 && (
                    <section className="py-24 bg-muted/30 border-y border-border/50">
                        <div className="container mx-auto px-4 text-center">
                            <h2 className="text-3xl md:text-5xl font-bold mb-16 tracking-tight">How It Works</h2>
                            <div className="grid md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
                                {/* Connecting line for desktop */}
                                <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border z-0"></div>

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
                )}

                {/* 5. Feature Showcase */}
                {features && features.length > 0 && (
                    <section id="features" className="py-24 bg-background relative">
                        <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
                        <div className="container mx-auto px-4 relative">
                            <div className="text-center mb-16 max-w-2xl mx-auto">
                                <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Powerful Features</h2>
                                <p className="text-lg text-muted-foreground">Everything you need to manage your work efficiently and collaborate with your team in one place.</p>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                )}

                {/* 6. Pricing */}
                {pricing && pricing.length > 0 && (
                    <section id="pricing" className="py-24 bg-muted/20 border-t border-border/50 relative">
                        <div className="container mx-auto px-4 relative z-10">
                            <div className="text-center mb-16 max-w-2xl mx-auto">
                                <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Simple Pricing Plans</h2>
                                <p className="text-lg text-muted-foreground">Transparent pricing designed to scale with your team.</p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                                {pricing.map((tier: any, i: number) => (
                                    <div key={i} className={`relative flex flex-col p-8 rounded-3xl border bg-card shadow-lg transition-transform hover:-translate-y-2 ${tier.is_popular ? 'border-primary ring-2 ring-primary/20 shadow-primary/10' : 'border-border/50'}`}>
                                        {tier.is_popular && (
                                            <div className="absolute -top-4 left-0 right-0 mx-auto w-fit px-4 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground bg-primary rounded-full shadow-lg">
                                                Most Popular
                                            </div>
                                        )}
                                        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                                        <div className="mb-6">
                                            <span className="text-5xl font-extrabold tracking-tight">{tier.description}</span>
                                        </div>
                                        <ul className="space-y-4 mb-8 flex-1">
                                            {tier.features?.map((f: any, j: number) => (
                                                <li key={j} className="flex items-center gap-3 text-sm">
                                                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${f.is_included || true ? 'text-primary' : 'text-muted/50'}`} />
                                                    <span className={f.is_included || true ? 'text-foreground font-medium' : 'text-muted-foreground line-through'}>{f.feature_name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <Button asChild className="w-full h-12 text-base rounded-full" variant={tier.is_popular ? 'default' : 'outline'}>
                                            <a href="/register">{tier.cta_text || 'Select Plan'}</a>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* 7. Testimonials */}
                {testimonials && testimonials.length > 0 && (
                    <section className="py-24 bg-background">
                        <div className="container mx-auto px-4">
                            <div className="text-center mb-16">
                                <h2 className="text-3xl md:text-5xl font-bold tracking-tight">What Our Users Say</h2>
                            </div>
                            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                                {testimonials.map((t: any, i: number) => (
                                    <div key={i} className="p-8 rounded-2xl bg-muted/30 border border-border/50 relative">
                                        <div className="flex text-yellow-500 mb-6">
                                            {[...Array(t.rating || 5)].map((_, j) => <Star key={j} className="w-5 h-5 fill-current" />)}
                                        </div>
                                        <p className="text-lg italic text-foreground mb-8 leading-relaxed">"{t.content}"</p>
                                        <div className="flex items-center gap-4">
                                            <img src={t.avatar_url} alt={t.author_name} className="w-12 h-12 rounded-full border border-border" />
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
                )}

                {/* 8. CTA Section */}
                {cta && (
                    <section className="py-32 bg-primary relative overflow-hidden">
                        {/* Background Patterns */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
                        <div className="container mx-auto px-4 relative z-10 text-center">
                            <div className="max-w-3xl mx-auto">
                                <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-primary-foreground">{cta.title}</h2>
                                <p className="text-xl text-primary-foreground/80 mb-10 leading-relaxed">
                                    {cta.description}
                                </p>
                                <Button size="lg" variant="secondary" className="h-16 px-10 text-lg rounded-full shadow-2xl hover:scale-105 transition-transform" asChild>
                                    <a href={cta.button_link}>{cta.button_text}</a>
                                </Button>
                            </div>
                        </div>
                    </section>
                )}

                {/* 9. Contact */}
                {contact && (
                    <section id="contact" className="py-24 bg-background border-t border-border/50">
                        <div className="container mx-auto px-4">
                            <div className="max-w-3xl mx-auto text-center">
                                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{contact.title}</h2>
                                <p className="text-lg text-muted-foreground mb-12">{contact.description}</p>

                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="flex flex-col items-center p-6 border border-border/50 rounded-2xl bg-muted/20">
                                        <Mail className="w-8 h-8 text-primary mb-4" />
                                        <h4 className="font-bold mb-2">Email</h4>
                                        <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary transition-colors">{contact.email}</a>
                                    </div>
                                    <div className="flex flex-col items-center p-6 border border-border/50 rounded-2xl bg-muted/20">
                                        <Phone className="w-8 h-8 text-primary mb-4" />
                                        <h4 className="font-bold mb-2">Phone</h4>
                                        <span className="text-muted-foreground">{contact.phone}</span>
                                    </div>
                                    <div className="flex flex-col items-center p-6 border border-border/50 rounded-2xl bg-muted/20">
                                        <MapPin className="w-8 h-8 text-primary mb-4" />
                                        <h4 className="font-bold mb-2">Address</h4>
                                        <span className="text-muted-foreground text-center">{contact.address}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* 10. Footer */}
            <footer className="border-t border-border/50 bg-card py-16">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-12 border-b border-border/50 pb-12 mb-8">
                        <div className="md:col-span-1">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                    {navbar?.brand_name?.charAt(0) || 'T'}
                                </div>
                                <span className="font-bold text-xl">{navbar?.brand_name || 'TaskManager'}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                A powerful task management platform designed to help teams organize work, collaborate efficiently, and achieve success.
                            </p>
                        </div>
                        {footer && footer.map((cat: any, i: number) => (
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
                        <p>&copy; {new Date().getFullYear()} {navbar?.brand_name || 'TaskManager'}. All Rights Reserved.</p>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span>All Systems Operational</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
