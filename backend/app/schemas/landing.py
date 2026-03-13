"""Pydantic schemas for the landing page."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ─── Navbar ────────────────────────────────────────────────────────────────────

class LandingNavbarBase(BaseModel):
    brand_name: str = "TaskFlow"
    logo_url: Optional[str] = None
    cta_text: str = "Get Started"
    cta_link: str = "/signup.html"
    nav_links: Optional[str] = None  # JSON string

class LandingNavbarResponse(LandingNavbarBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Hero ──────────────────────────────────────────────────────────────────────

class LandingHeroBase(BaseModel):
    headline: str
    sub_headline: Optional[str] = None
    cta_text: str = "Start Your Free Trial"
    cta_link: str = "/signup.html"
    secondary_cta_text: Optional[str] = None
    secondary_cta_link: Optional[str] = None
    visual_image_url: Optional[str] = None

class LandingHeroResponse(LandingHeroBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Stats ─────────────────────────────────────────────────────────────────────

class LandingStatBase(BaseModel):
    value: str
    label: str
    icon_name: str = "users"
    sort_order: int = 0

class LandingStatResponse(LandingStatBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Features ──────────────────────────────────────────────────────────────────

class LandingFeatureBase(BaseModel):
    title: str
    description: str
    icon_name: str
    sort_order: int = 0

class LandingFeatureCreate(LandingFeatureBase):
    pass

class LandingFeatureResponse(LandingFeatureBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Testimonials ──────────────────────────────────────────────────────────────

class LandingTestimonialBase(BaseModel):
    author_name: str
    author_role: str
    author_company: str
    avatar_url: Optional[str] = None
    content: str
    rating: int = 5
    sort_order: int = 0

class LandingTestimonialCreate(LandingTestimonialBase):
    pass

class LandingTestimonialResponse(LandingTestimonialBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Badges ────────────────────────────────────────────────────────────────────

class LandingBadgeBase(BaseModel):
    name: str
    image_url: str
    link_url: Optional[str] = None
    sort_order: int = 0

class LandingBadgeResponse(LandingBadgeBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Pricing ───────────────────────────────────────────────────────────────────

class PricingFeatureBase(BaseModel):
    feature_name: str
    is_included: bool = True
    sort_order: int = 0

class PricingFeatureResponse(PricingFeatureBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


class PricingTierBase(BaseModel):
    name: str
    description: Optional[str] = None
    monthly_price: Optional[float] = None
    annual_price: Optional[float] = None
    is_popular: bool = False
    cta_text: str = "Get Started"
    sort_order: int = 0

class PricingTierCreate(PricingTierBase):
    features: List[PricingFeatureBase] = []

class PricingTierResponse(PricingTierBase):
    id: str
    features: List[PricingFeatureResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ─── Footer ────────────────────────────────────────────────────────────────────

class FooterLinkBase(BaseModel):
    title: str
    url: str
    sort_order: int = 0

class FooterLinkResponse(FooterLinkBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


class FooterCategoryBase(BaseModel):
    name: str
    sort_order: int = 0

class FooterCategoryResponse(FooterCategoryBase):
    id: str
    links: List[FooterLinkResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ─── About ─────────────────────────────────────────────────────────────────────

class LandingAboutBase(BaseModel):
    title: str
    description: str
    points: Optional[str] = None

class LandingAboutResponse(LandingAboutBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Steps ──────────────────────────────────────────────────────────────────────

class LandingStepBase(BaseModel):
    step_number: int
    title: str
    description: str

class LandingStepResponse(LandingStepBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── CTA ────────────────────────────────────────────────────────────────────────

class LandingCTABase(BaseModel):
    title: str
    description: str
    button_text: str = "Create Free Account"
    button_link: str = "/signup.html"

class LandingCTAResponse(LandingCTABase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Contact ────────────────────────────────────────────────────────────────────

class LandingContactBase(BaseModel):
    title: str = "Get In Touch"
    description: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None

class LandingContactResponse(LandingContactBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ─── Aggregate ─────────────────────────────────────────────────────────────────

class LandingContentResponse(BaseModel):
    """Aggregate response model for the public landing page."""
    navbar: Optional[LandingNavbarResponse] = None
    hero: Optional[LandingHeroResponse] = None
    stats: List[LandingStatResponse] = []
    features: List[LandingFeatureResponse] = []
    testimonials: List[LandingTestimonialResponse] = []
    badges: List[LandingBadgeResponse] = []
    pricing: List[PricingTierResponse] = []
    footer: List[FooterCategoryResponse] = []
    about: Optional[LandingAboutResponse] = None
    steps: List[LandingStepResponse] = []
    cta: Optional[LandingCTAResponse] = None
    contact: Optional[LandingContactResponse] = None


# ─── Lead Capture ──────────────────────────────────────────────────────────────

class LeadCaptureCreate(BaseModel):
    email: EmailStr
    organization_name: str

class LandingLeadResponse(LeadCaptureCreate):
    id: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
