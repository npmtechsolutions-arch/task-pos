"""Seed script for default dynamic landing page content."""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))

import asyncio
import json
import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, engine
from app.db.base import Base

from app.models.landing import (
    FooterCategory,
    FooterLink,
    LandingAbout,
    LandingBadge,
    LandingContact,
    LandingCTA,
    LandingFeature,
    LandingHero,
    LandingNavbar,
    LandingStat,
    LandingStep,
    LandingTestimonial,
    PricingFeature,
    PricingTier,
)
from app.models.tenant import Tenant, TenantStatus
from app.models.user import User, UserRole, UserStatus
from app.core.security import get_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def get_or_create_tenant(session: AsyncSession) -> str:
    """Return the ID of the first tenant, creating a default one if none exist."""
    result = await session.execute(select(Tenant).limit(1))
    tenant = result.scalars().first()
    if tenant:
        logger.info(f"Using existing tenant: {tenant.name} ({tenant.id})")
        return tenant.id

    logger.info("No tenant found — creating default 'ProjectFlow' tenant...")
    new_tenant = Tenant(
        id=str(uuid.uuid4()),
        name="ProjectFlow",
        slug="projectflow",
        plan="enterprise",
        status=TenantStatus.ACTIVE,
        settings={},
        branding={},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(new_tenant)
    await session.flush()
    logger.info(f"Default tenant created: {new_tenant.id}")
    return new_tenant.id


async def seed_data():
    """Create tables if they don't exist and seed default content."""

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")

    async with AsyncSessionLocal() as session:

        # ── Step 1: Resolve tenant FIRST (required by users.tenant_id NOT NULL) ──
        tenant_id = await get_or_create_tenant(session)

        # ── Step 2: Seed landing content (idempotent) ────────────────────────
        hero_exists = await session.execute(select(LandingHero).limit(1))
        if hero_exists.scalars().first():
            logger.info("Landing content already seeded. Skipping.")
        else:
            logger.info("Seeding default landing content...")

            session.add(LandingNavbar(
                id=str(uuid.uuid4()),
                brand_name="ProjectFlow",
                cta_text="Get Started Free",
                cta_link="/login",
                nav_links=json.dumps([
                    {"label": "Features",     "href": "#features"},
                    {"label": "Testimonials", "href": "#testimonials"},
                    {"label": "Pricing",      "href": "#pricing"},
                ])
            ))

            session.add(LandingHero(
                id=str(uuid.uuid4()),
                headline="Manage Projects. Track Tasks. Scale Your Team.",
                sub_headline="ProjectFlow helps teams collaborate in real-time, manage workloads efficiently, and deliver projects faster — all in one unified platform.",
                cta_text="Get Started Free",
                cta_link="/login",
                secondary_cta_text="Book a Demo",
                secondary_cta_link="#contact",
                visual_image_url="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
            ))

            session.add(LandingAbout(
                id=str(uuid.uuid4()),
                title="Why Choose ProjectFlow",
                description="Built for modern teams — from solo developers to enterprise organizations. ProjectFlow adapts to your workflow.",
                points=json.dumps([
                    "Real-time collaboration across teams",
                    "Enterprise-grade security & SOC2 compliance",
                    "Kanban, List, and Calendar views",
                    "Advanced analytics and reporting",
                ])
            ))

            session.add_all([
                LandingStat(id=str(uuid.uuid4()), value="50,000+", label="Active Users",     icon_name="users",        sort_order=1),
                LandingStat(id=str(uuid.uuid4()), value="99.9%",   label="Uptime Guarantee", icon_name="server",       sort_order=2),
                LandingStat(id=str(uuid.uuid4()), value="10M+",    label="Tasks Completed",  icon_name="check-circle", sort_order=3),
                LandingStat(id=str(uuid.uuid4()), value="24/7",    label="Support",          icon_name="headphones",   sort_order=4),
            ])

            session.add_all([
                LandingFeature(id=str(uuid.uuid4()), title="Task Management",     description="Create, assign, and track tasks with priorities and deadlines.",         icon_name="check-square", sort_order=1),
                LandingFeature(id=str(uuid.uuid4()), title="Team Collaboration",  description="Work together in real-time with comments, mentions, and file sharing.",  icon_name="users",        sort_order=2),
                LandingFeature(id=str(uuid.uuid4()), title="Project Analytics",   description="Dashboards and reports that show exactly where your project stands.",    icon_name="pie-chart",    sort_order=3),
                LandingFeature(id=str(uuid.uuid4()), title="Smart Notifications", description="Never miss a deadline with intelligent reminders and alerts.",           icon_name="bell",         sort_order=4),
                LandingFeature(id=str(uuid.uuid4()), title="Kanban Boards",       description="Visualize your workflow with drag-and-drop Kanban boards.",              icon_name="layout",       sort_order=5),
                LandingFeature(id=str(uuid.uuid4()), title="Time Tracking",       description="Log hours, measure productivity, and generate billable reports.",        icon_name="clock",        sort_order=6),
            ])

            session.add_all([
                LandingStep(id=str(uuid.uuid4()), step_number=1, title="Create Your Workspace", description="Sign up, set up your organization, and invite your team in minutes."),
                LandingStep(id=str(uuid.uuid4()), step_number=2, title="Plan & Assign Tasks",   description="Create projects, define phases, and assign tasks to the right people."),
                LandingStep(id=str(uuid.uuid4()), step_number=3, title="Track & Deliver",       description="Monitor progress in real-time and deliver projects on time, every time."),
            ])

            session.add_all([
                LandingTestimonial(id=str(uuid.uuid4()), author_name="Arjun Mehta",  author_role="CTO",              author_company="TechScale", avatar_url="https://i.pravatar.cc/150?u=arjun", content="ProjectFlow cut our delivery time by 40%. The Kanban boards and analytics are game-changers.",        rating=5, sort_order=1),
                LandingTestimonial(id=str(uuid.uuid4()), author_name="Sneha Kapoor", author_role="Project Manager",  author_company="DesignHub", avatar_url="https://i.pravatar.cc/150?u=sneha", content="Finally a tool that our whole team actually uses. Clean interface, deep features.",                    rating=5, sort_order=2),
                LandingTestimonial(id=str(uuid.uuid4()), author_name="Ravi Shankar", author_role="Engineering Lead", author_company="CloudOps",  avatar_url="https://i.pravatar.cc/150?u=ravi",  content="The time tracking and reporting features alone justify the subscription. Highly recommend.",           rating=5, sort_order=3),
            ])

            session.add_all([
                LandingBadge(id=str(uuid.uuid4()), name="SOC2 Compliant", image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/SOC_2_Logo.svg/512px-SOC_2_Logo.svg.png", sort_order=1),
                LandingBadge(id=str(uuid.uuid4()), name="GDPR Ready",     image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/GDPR_logo.svg/512px-GDPR_logo.svg.png",  sort_order=2),
            ])

            t1 = PricingTier(id=str(uuid.uuid4()), name="Starter",  description="Perfect for individuals",  monthly_price=0.00,  annual_price=0.00,   cta_text="Get Started Free", is_popular=False, sort_order=1)
            t2 = PricingTier(id=str(uuid.uuid4()), name="Pro",      description="For growing teams",        monthly_price=9.00,  annual_price=90.00,  cta_text="Start Pro Trial",  is_popular=True,  sort_order=2)
            t3 = PricingTier(id=str(uuid.uuid4()), name="Business", description="For large organizations",  monthly_price=29.00, annual_price=290.00, cta_text="Contact Sales",    is_popular=False, sort_order=3)
            session.add_all([t1, t2, t3])
            await session.flush()

            session.add_all([
                PricingFeature(id=str(uuid.uuid4()), tier_id=t1.id, feature_name="Up to 3 projects",          sort_order=1),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t1.id, feature_name="5 team members",            sort_order=2),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t1.id, feature_name="Basic task management",     sort_order=3),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Unlimited projects",        sort_order=1),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Up to 25 members",          sort_order=2),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Kanban + Gantt + Calendar", sort_order=3),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Time tracking",             sort_order=4),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Unlimited members",         sort_order=1),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Advanced analytics",        sort_order=2),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Custom integrations",       sort_order=3),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Dedicated support",         sort_order=4),
            ])

            session.add(LandingCTA(
                id=str(uuid.uuid4()),
                title="Ready to Transform Your Team's Productivity?",
                description="Join 50,000+ teams who use ProjectFlow to deliver projects on time and on budget.",
                button_text="Start for Free",
                button_link="/login"
            ))

            session.add(LandingContact(
                id=str(uuid.uuid4()),
                title="Get In Touch",
                description="Have questions or need a demo? Our team is here to help.",
                email="hello@projectflow.com",
                phone="+91 98765 43210",
                address="Madurai, Tamil Nadu, India"
            ))

            cat1 = FooterCategory(id=str(uuid.uuid4()), name="Product", sort_order=1)
            cat2 = FooterCategory(id=str(uuid.uuid4()), name="Company", sort_order=2)
            cat3 = FooterCategory(id=str(uuid.uuid4()), name="Support", sort_order=3)
            session.add_all([cat1, cat2, cat3])
            await session.flush()

            session.add_all([
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Features",  url="#features",  sort_order=1),
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Pricing",   url="#pricing",   sort_order=2),
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Changelog", url="#",          sort_order=3),
                FooterLink(id=str(uuid.uuid4()), category_id=cat2.id, title="About",     url="#about",     sort_order=1),
                FooterLink(id=str(uuid.uuid4()), category_id=cat2.id, title="Blog",      url="#",          sort_order=2),
                FooterLink(id=str(uuid.uuid4()), category_id=cat2.id, title="Careers",   url="#",          sort_order=3),
                FooterLink(id=str(uuid.uuid4()), category_id=cat3.id, title="Contact",   url="#contact",   sort_order=1),
                FooterLink(id=str(uuid.uuid4()), category_id=cat3.id, title="Login",     url="/login",     sort_order=2),
                FooterLink(id=str(uuid.uuid4()), category_id=cat3.id, title="Sign Up",   url="/login",     sort_order=3),
            ])

            logger.info("Landing content seeded successfully.")

        # ── Step 3: Seed Admin User (WITH tenant_id) ─────────────────────────
        admin_email = "admin@projectflow.com"
        admin_exists = await session.execute(select(User).where(User.email == admin_email))
        if admin_exists.scalars().first():
            logger.info(f"Admin user '{admin_email}' already exists. Skipping.")
        else:
            logger.info(f"Creating admin user: {admin_email}")
            session.add(User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,          # ← THE FIX: always set tenant_id
                email=admin_email,
                password_hash=get_password_hash("271527"),
                first_name="System",
                last_name="Admin",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            ))
            logger.info(f"Admin created → email: {admin_email}  password: 271527")

        await session.commit()

    logger.info("✅ Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_data())
