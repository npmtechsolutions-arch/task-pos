"""Landing page models."""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LandingNavbar(Base):
    """Navbar / header section content."""

    __tablename__ = "landing_navbar"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    brand_name: Mapped[str] = mapped_column(String(100), default="TaskFlow")
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    cta_text: Mapped[str] = mapped_column(String(100), default="Get Started")
    cta_link: Mapped[str] = mapped_column(String(255), default="/signup.html")
    nav_links: Mapped[Optional[str]] = mapped_column(Text)  # JSON string: [{"label":"Features","href":"#features"}]

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingHero(Base):
    """Hero section content for the landing page."""

    __tablename__ = "landing_heroes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    sub_headline: Mapped[Optional[str]] = mapped_column(Text)
    cta_text: Mapped[str] = mapped_column(String(100), default="Start Your Free Trial")
    cta_link: Mapped[str] = mapped_column(String(255), default="/signup.html")
    secondary_cta_text: Mapped[Optional[str]] = mapped_column(String(100))
    secondary_cta_link: Mapped[Optional[str]] = mapped_column(String(255))
    visual_image_url: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingStat(Base):
    """Stats bar items (e.g., '10k+ Users', '99.9% Uptime')."""

    __tablename__ = "landing_stats"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    value: Mapped[str] = mapped_column(String(50), nullable=False)   # e.g., "10,000+"
    label: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Active Users"
    icon_name: Mapped[str] = mapped_column(String(100), default="users")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingFeature(Base):
    """Features to showcase on the landing page."""

    __tablename__ = "landing_features"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_name: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingTestimonial(Base):
    """Customer testimonials."""

    __tablename__ = "landing_testimonials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_name: Mapped[str] = mapped_column(String(100), nullable=False)
    author_role: Mapped[str] = mapped_column(String(100), nullable=False)
    author_company: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, default=5)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingBadge(Base):
    """Social proof badges (e.g., SOC2, GDPR)."""

    __tablename__ = "landing_badges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    link_url: Mapped[Optional[str]] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PricingTier(Base):
    """Pricing tiers for the platform."""

    __tablename__ = "pricing_tiers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    monthly_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    annual_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    cta_text: Mapped[str] = mapped_column(String(100), default="Get Started")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    features: Mapped[List["PricingFeature"]] = relationship(
        "PricingFeature", back_populates="tier", cascade="all, delete-orphan", lazy="selectin"
    )


class PricingFeature(Base):
    """Features associated with a specific pricing tier."""

    __tablename__ = "pricing_features"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tier_id: Mapped[str] = mapped_column(String(36), ForeignKey("pricing_tiers.id"), nullable=False)
    feature_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_included: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    tier: Mapped["PricingTier"] = relationship("PricingTier", back_populates="features")


class FooterCategory(Base):
    """Categories for the footer links."""

    __tablename__ = "footer_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    links: Mapped[List["FooterLink"]] = relationship(
        "FooterLink", back_populates="category", cascade="all, delete-orphan", lazy="selectin"
    )


class FooterLink(Base):
    """Individual footer links."""

    __tablename__ = "footer_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("footer_categories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped["FooterCategory"] = relationship("FooterCategory", back_populates="links")


class LandingAbout(Base):
    """About / Why Choose Us section content."""

    __tablename__ = "landing_about"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[Optional[str]] = mapped_column(Text)  # JSON string of bullet points

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingStep(Base):
    """How it works / Steps timeline content."""

    __tablename__ = "landing_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingCTA(Base):
    """Large bottom Call-To-Action section."""

    __tablename__ = "landing_cta"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    button_text: Mapped[str] = mapped_column(String(100), default="Create Free Account")
    button_link: Mapped[str] = mapped_column(String(500), default="/signup.html")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingContact(Base):
    """Contact details section."""

    __tablename__ = "landing_contact"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), default="Get In Touch")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LandingLead(Base):
    """Captured leads from the landing page initialization form."""

    __tablename__ = "landing_leads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(50), default="new")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
