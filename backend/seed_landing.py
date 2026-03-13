"""Seed script for default dynamic landing page content."""

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
from app.models.user import User, UserRole, UserStatus
from app.core.security import get_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_data():
    """Create tables if they don't exist and seed default content."""

    # Ensure tables are created (we rely on SQLAlchemy rather than Alembic here for simplicity)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")

    async with AsyncSessionLocal() as session:
        # Check if already seeded to prevent duplication
        hero_exists = await session.execute(select(LandingHero).limit(1))
        if hero_exists.scalars().first():
            logger.info("Database is already seeded with landing content. Skipping.")
        else:
            logger.info("Seeding default landing content...")

            # 1. Navbar
            navbar = LandingNavbar(
                id=str(uuid.uuid4()),
                brand_name="TaskFlow",
                cta_text="Get Started Free",
                cta_link="/signup.html",
                nav_links=json.dumps([
                    {"label": "Features", "href": "#features"},
                    {"label": "Testimonials", "href": "#testimonials"},
                    {"label": "Pricing", "href": "#pricing"}
                ])
            )
            session.add(navbar)

            # 2. Hero
            hero = LandingHero(
                id=str(uuid.uuid4()),
                headline="Manage Your Tasks Smarter",
                sub_headline="Plan, organize, and track your work with a powerful task management system designed for teams and businesses.",
                cta_text="Get Started",
                cta_link="/signup.html",
                secondary_cta_text="View Features",
                secondary_cta_link="#features",
                visual_image_url="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
            )
            session.add(hero)

            # 2.5 About
            about = LandingAbout(
                id=str(uuid.uuid4()),
                title="Why Choose Our Task Manager",
                description="Our task management platform is built to help individuals and teams stay organized, increase productivity, and achieve goals faster. With an intuitive interface and powerful tools, managing projects has never been easier.",
                points=json.dumps([
                    "Simple and easy-to-use interface",
                    "Real-time collaboration tools",
                    "Secure and reliable system",
                    "Scalable for teams and companies"
                ])
            )
            session.add(about)

            # 3. Stats
            stats = [
                LandingStat(id=str(uuid.uuid4()), value="10,000+", label="Active Users", icon_name="users", sort_order=1),
                LandingStat(id=str(uuid.uuid4()), value="99.9%", label="Uptime Guarantee", icon_name="server", sort_order=2),
                LandingStat(id=str(uuid.uuid4()), value="5M+", label="Tasks Completed", icon_name="check-circle", sort_order=3),
                LandingStat(id=str(uuid.uuid4()), value="24/7", label="Customer Support", icon_name="headphones", sort_order=4),
            ]
            session.add_all(stats)

            # 4. Features
            features = [
                LandingFeature(id=str(uuid.uuid4()), title="Task Management", description="Create, assign, and track tasks easily. Organize your work with clear priorities and deadlines.", icon_name="check-square", sort_order=1),
                LandingFeature(id=str(uuid.uuid4()), title="Team Collaboration", description="Work together with your team members, share updates, and collaborate in real time.", icon_name="users", sort_order=2),
                LandingFeature(id=str(uuid.uuid4()), title="Project Tracking", description="Monitor project progress with dashboards and visual progress indicators.", icon_name="pie-chart", sort_order=3),
                LandingFeature(id=str(uuid.uuid4()), title="Deadline Reminders", description="Never miss a deadline again with automated reminders and notifications.", icon_name="bell", sort_order=4),
            ]
            session.add_all(features)

            # 4.5 How It Works (Steps)
            steps = [
                LandingStep(id=str(uuid.uuid4()), step_number=1, title="Step 1", description="Create your account and start a new project."),
                LandingStep(id=str(uuid.uuid4()), step_number=2, title="Step 2", description="Add tasks and assign them to team members."),
                LandingStep(id=str(uuid.uuid4()), step_number=3, title="Step 3", description="Track progress and complete projects efficiently."),
            ]
            session.add_all(steps)

            # 5. Testimonials
            testimonials = [
                LandingTestimonial(id=str(uuid.uuid4()), author_name="Rahul Sharma", author_role="Project Manager", author_company="TechCorp", avatar_url="https://i.pravatar.cc/150?u=a042581f4e29026704d", content="This platform completely changed how our team manages projects. It's simple and very effective.", rating=5, sort_order=1),
                LandingTestimonial(id=str(uuid.uuid4()), author_name="Priya Nair", author_role="Team Lead", author_company="DevStudio", avatar_url="https://i.pravatar.cc/150?u=a042581f4e29026703d", content="Task tracking and collaboration are extremely smooth. Highly recommended for teams.", rating=5, sort_order=2),
            ]
            session.add_all(testimonials)

            # 6. Badges (Social Proof)
            badges = [
                LandingBadge(id=str(uuid.uuid4()), name="SOC2 Compliant", image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/SOC_2_Logo.svg/512px-SOC_2_Logo.svg.png", sort_order=1),
                LandingBadge(id=str(uuid.uuid4()), name="GDPR Ready", image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/GDPR_logo.svg/512px-GDPR_logo.svg.png", sort_order=2),
            ]
            session.add_all(badges)

            # 7. Pricing
            t1 = PricingTier(id=str(uuid.uuid4()), name="Starter Plan", description="Free", monthly_price=0.00, annual_price=0.00, cta_text="Get Started", is_popular=False, sort_order=1)
            t2 = PricingTier(id=str(uuid.uuid4()), name="Pro Plan", description="$9 / month", monthly_price=9.00, annual_price=90.00, cta_text="Get Pro", is_popular=True, sort_order=2)
            t3 = PricingTier(id=str(uuid.uuid4()), name="Business Plan", description="$29 / month", monthly_price=29.00, annual_price=290.00, cta_text="Get Business", is_popular=False, sort_order=3)
            
            session.add_all([t1, t2, t3])
            await session.flush() # flush to get IDs

            p_features = [
                PricingFeature(id=str(uuid.uuid4()), tier_id=t1.id, feature_name="Up to 5 projects", sort_order=1),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t1.id, feature_name="Basic task management", sort_order=2),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t1.id, feature_name="Email support", sort_order=3),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Unlimited projects", sort_order=1),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Team collaboration", sort_order=2),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Deadline reminders", sort_order=3),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t2.id, feature_name="Priority support", sort_order=4),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Unlimited users", sort_order=1),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Advanced analytics", sort_order=2),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Project reports", sort_order=3),
                PricingFeature(id=str(uuid.uuid4()), tier_id=t3.id, feature_name="Dedicated support", sort_order=4),
            ]
            session.add_all(p_features)

            # 8. CTA
            cta = LandingCTA(
                id=str(uuid.uuid4()),
                title="Start Managing Your Tasks Today",
                description="Join thousands of teams who trust our platform to organize their work and boost productivity.",
                button_text="Create Free Account",
                button_link="/signup.html"
            )
            session.add(cta)

            # 9. Contact
            contact = LandingContact(
                id=str(uuid.uuid4()),
                title="Get In Touch",
                description="Have questions or need support? Our team is here to help.",
                email="support@taskmanager.com",
                phone="+91 98765 43210",
                address="Madurai, Tamil Nadu, India"
            )
            session.add(contact)

            # 10. Footer
            cat1 = FooterCategory(id=str(uuid.uuid4()), name="Company", sort_order=1)
            cat2 = FooterCategory(id=str(uuid.uuid4()), name="Legal", sort_order=2)
            session.add_all([cat1, cat2])
            await session.flush()

            footer_links = [
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Home", url="#", sort_order=1),
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Features", url="#features", sort_order=2),
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Pricing", url="#pricing", sort_order=3),
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="About", url="#about", sort_order=4),
                FooterLink(id=str(uuid.uuid4()), category_id=cat1.id, title="Contact", url="#contact", sort_order=5),
                FooterLink(id=str(uuid.uuid4()), category_id=cat2.id, title="Login", url="/login.html", sort_order=1),
                FooterLink(id=str(uuid.uuid4()), category_id=cat2.id, title="Signup", url="/signup.html", sort_order=2),
            ]
            session.add_all(footer_links)

            logger.info("Landing content seeded.")

        # --- Seed an Admin User ---
        admin_email = "admin@taskflow.com"
        admin_exists = await session.execute(select(User).where(User.email == admin_email))
        if admin_exists.scalars().first():
            logger.info(f"Admin user {admin_email} already exists. Skipping.")
        else:
            logger.info(f"Seeding admin user: {admin_email}")
            admin_user = User(
                id=str(uuid.uuid4()),
                email=admin_email,
                password_hash=get_password_hash("admin123"),
                first_name="System",
                last_name="Admin",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(admin_user)
            logger.info("Admin user created.")

        await session.commit()
    
    logger.info("Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_data())
