"""Landing page API endpoints — public + admin CRUD."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.landing import (
    FooterCategory,
    FooterLink,
    LandingAbout,
    LandingBadge,
    LandingCTA,
    LandingContact,
    LandingFeature,
    LandingHero,
    LandingLead,
    LandingNavbar,
    LandingStat,
    LandingStep,
    LandingTestimonial,
    PricingFeature,
    PricingTier,
)
from app.models.user import UserRole
from app.schemas.landing import (
    FooterCategoryBase,
    FooterCategoryResponse,
    FooterLinkBase,
    FooterLinkResponse,
    LandingAboutBase,
    LandingAboutResponse,
    LandingBadgeBase,
    LandingBadgeResponse,
    LandingContactBase,
    LandingContactResponse,
    LandingContentResponse,
    LandingCTABase,
    LandingCTAResponse,
    LandingFeatureCreate,
    LandingFeatureResponse,
    LandingHeroBase,
    LandingHeroResponse,
    LandingLeadResponse,
    LandingNavbarBase,
    LandingNavbarResponse,
    LandingStatBase,
    LandingStatResponse,
    LandingStepBase,
    LandingStepResponse,
    LandingTestimonialCreate,
    LandingTestimonialResponse,
    LeadCaptureCreate,
    PricingTierCreate,
    PricingTierResponse,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════
# PUBLIC ENDPOINT
# ═══════════════════════════════════════════════════════════

@router.get("/content", response_model=LandingContentResponse)
async def get_landing_content(db: AsyncSession = Depends(get_db)) -> Any:
    """Retrieve ALL dynamic content for the landing page (public)."""

    navbar_result = await db.execute(select(LandingNavbar).order_by(LandingNavbar.created_at.desc()).limit(1))
    navbar = navbar_result.scalars().first()

    hero_result = await db.execute(select(LandingHero).order_by(LandingHero.created_at.desc()).limit(1))
    hero = hero_result.scalars().first()

    stats_result = await db.execute(select(LandingStat).order_by(LandingStat.sort_order))
    stats = stats_result.scalars().all()

    features_result = await db.execute(select(LandingFeature).order_by(LandingFeature.sort_order))
    features = features_result.scalars().all()

    testimonials_result = await db.execute(select(LandingTestimonial).order_by(LandingTestimonial.sort_order))
    testimonials = testimonials_result.scalars().all()

    badges_result = await db.execute(select(LandingBadge).order_by(LandingBadge.sort_order))
    badges = badges_result.scalars().all()

    pricing_result = await db.execute(select(PricingTier).order_by(PricingTier.sort_order))
    pricing = pricing_result.scalars().all()

    footer_result = await db.execute(select(FooterCategory).order_by(FooterCategory.sort_order))
    footer = footer_result.scalars().all()

    about_result = await db.execute(select(LandingAbout).order_by(LandingAbout.created_at.desc()).limit(1))
    about = about_result.scalars().first()

    steps_result = await db.execute(select(LandingStep).order_by(LandingStep.step_number))
    steps = steps_result.scalars().all()

    cta_result = await db.execute(select(LandingCTA).order_by(LandingCTA.created_at.desc()).limit(1))
    cta = cta_result.scalars().first()

    contact_result = await db.execute(select(LandingContact).order_by(LandingContact.created_at.desc()).limit(1))
    contact = contact_result.scalars().first()

    return {
        "navbar": navbar,
        "hero": hero,
        "stats": list(stats),
        "features": list(features),
        "testimonials": list(testimonials),
        "badges": list(badges),
        "pricing": list(pricing),
        "footer": list(footer),
        "about": about,
        "steps": list(steps),
        "cta": cta,
        "contact": contact,
    }


@router.post("/lead", response_model=LandingLeadResponse, status_code=status.HTTP_201_CREATED)
async def capture_lead(lead_in: LeadCaptureCreate, db: AsyncSession = Depends(get_db)) -> Any:
    """Capture a new lead from the landing page."""
    db_lead = LandingLead(
        email=lead_in.email,
        organization_name=lead_in.organization_name,
        company_id=lead_in.organization_name.lower().replace(" ", "-"),
    )
    db.add(db_lead)
    await db.commit()
    await db.refresh(db_lead)
    return db_lead


# ═══════════════════════════════════════════════════════════
# ADMIN ENDPOINTS — require admin or owner role
# ═══════════════════════════════════════════════════════════

async def require_admin(current_user=Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.OWNER]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Navbar ─────────────────────────────────────────────────

@router.get("/admin/navbar", response_model=LandingNavbarResponse)
async def admin_get_navbar(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingNavbar).limit(1))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Navbar not found")
    return row

@router.put("/admin/navbar", response_model=LandingNavbarResponse)
async def admin_update_navbar(data: LandingNavbarBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingNavbar).limit(1))
    row = result.scalars().first()
    if not row:
        row = LandingNavbar(id=str(uuid.uuid4()))
        db.add(row)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


# ── Hero ───────────────────────────────────────────────────

@router.get("/admin/hero", response_model=LandingHeroResponse)
async def admin_get_hero(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingHero).order_by(LandingHero.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Hero not found")
    return row

@router.put("/admin/hero", response_model=LandingHeroResponse)
async def admin_update_hero(data: LandingHeroBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingHero).order_by(LandingHero.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        row = LandingHero(id=str(uuid.uuid4()))
        db.add(row)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


# ── Stats ──────────────────────────────────────────────────

@router.get("/admin/stats", response_model=list[LandingStatResponse])
async def admin_get_stats(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingStat).order_by(LandingStat.sort_order))
    return result.scalars().all()

@router.post("/admin/stats", response_model=LandingStatResponse, status_code=201)
async def admin_create_stat(data: LandingStatBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    row = LandingStat(id=str(uuid.uuid4()), **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.put("/admin/stats/{stat_id}", response_model=LandingStatResponse)
async def admin_update_stat(stat_id: str, data: LandingStatBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingStat).where(LandingStat.id == stat_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Stat not found")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/admin/stats/{stat_id}", status_code=204)
async def admin_delete_stat(stat_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingStat).where(LandingStat.id == stat_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Stat not found")
    await db.delete(row)
    await db.commit()


# ── Features ───────────────────────────────────────────────

@router.get("/admin/features", response_model=list[LandingFeatureResponse])
async def admin_get_features(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingFeature).order_by(LandingFeature.sort_order))
    return result.scalars().all()

@router.post("/admin/features", response_model=LandingFeatureResponse, status_code=201)
async def admin_create_feature(data: LandingFeatureCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    row = LandingFeature(id=str(uuid.uuid4()), **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.put("/admin/features/{feature_id}", response_model=LandingFeatureResponse)
async def admin_update_feature(feature_id: str, data: LandingFeatureCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingFeature).where(LandingFeature.id == feature_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Feature not found")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/admin/features/{feature_id}", status_code=204)
async def admin_delete_feature(feature_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingFeature).where(LandingFeature.id == feature_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Feature not found")
    await db.delete(row)
    await db.commit()


# ── Testimonials ───────────────────────────────────────────

@router.get("/admin/testimonials", response_model=list[LandingTestimonialResponse])
async def admin_get_testimonials(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingTestimonial).order_by(LandingTestimonial.sort_order))
    return result.scalars().all()

@router.post("/admin/testimonials", response_model=LandingTestimonialResponse, status_code=201)
async def admin_create_testimonial(data: LandingTestimonialCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    row = LandingTestimonial(id=str(uuid.uuid4()), **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.put("/admin/testimonials/{tid}", response_model=LandingTestimonialResponse)
async def admin_update_testimonial(tid: str, data: LandingTestimonialCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingTestimonial).where(LandingTestimonial.id == tid))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/admin/testimonials/{tid}", status_code=204)
async def admin_delete_testimonial(tid: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingTestimonial).where(LandingTestimonial.id == tid))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await db.delete(row)
    await db.commit()


# ── Pricing ────────────────────────────────────────────────

@router.get("/admin/pricing", response_model=list[PricingTierResponse])
async def admin_get_pricing(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(PricingTier).order_by(PricingTier.sort_order))
    return result.scalars().all()

@router.post("/admin/pricing", response_model=PricingTierResponse, status_code=201)
async def admin_create_pricing(data: PricingTierCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    tier_data = data.model_dump(exclude={"features"})
    tier = PricingTier(id=str(uuid.uuid4()), **tier_data)
    db.add(tier)
    await db.flush()
    for f in data.features:
        feat = PricingFeature(id=str(uuid.uuid4()), tier_id=tier.id, **f.model_dump())
        db.add(feat)
    await db.commit()
    await db.refresh(tier)
    return tier

@router.put("/admin/pricing/{tier_id}", response_model=PricingTierResponse)
async def admin_update_pricing(tier_id: str, data: PricingTierCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(PricingTier).where(PricingTier.id == tier_id))
    tier = result.scalars().first()
    if not tier:
        raise HTTPException(status_code=404, detail="Pricing tier not found")
    tier_data = data.model_dump(exclude={"features"})
    for k, v in tier_data.items():
        setattr(tier, k, v)
    # Replace features
    for existing_feat in tier.features:
        await db.delete(existing_feat)
    await db.flush()
    for f in data.features:
        feat = PricingFeature(id=str(uuid.uuid4()), tier_id=tier.id, **f.model_dump())
        db.add(feat)
    await db.commit()
    await db.refresh(tier)
    return tier

@router.delete("/admin/pricing/{tier_id}", status_code=204)
async def admin_delete_pricing(tier_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(PricingTier).where(PricingTier.id == tier_id))
    tier = result.scalars().first()
    if not tier:
        raise HTTPException(status_code=404, detail="Pricing tier not found")
    await db.delete(tier)
    await db.commit()


# ── Footer ─────────────────────────────────────────────────

@router.get("/admin/footer", response_model=list[FooterCategoryResponse])
async def admin_get_footer(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(FooterCategory).order_by(FooterCategory.sort_order))
    return result.scalars().all()

@router.post("/admin/footer/categories", response_model=FooterCategoryResponse, status_code=201)
async def admin_create_footer_category(data: FooterCategoryBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    row = FooterCategory(id=str(uuid.uuid4()), **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.put("/admin/footer/categories/{cat_id}", response_model=FooterCategoryResponse)
async def admin_update_footer_category(cat_id: str, data: FooterCategoryBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(FooterCategory).where(FooterCategory.id == cat_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/admin/footer/categories/{cat_id}", status_code=204)
async def admin_delete_footer_category(cat_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(FooterCategory).where(FooterCategory.id == cat_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(row)
    await db.commit()

@router.post("/admin/footer/categories/{cat_id}/links", response_model=FooterLinkResponse, status_code=201)
async def admin_create_footer_link(cat_id: str, data: FooterLinkBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    row = FooterLink(id=str(uuid.uuid4()), category_id=cat_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/admin/footer/links/{link_id}", status_code=204)
async def admin_delete_footer_link(link_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(FooterLink).where(FooterLink.id == link_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(row)
    await db.commit()


# ── About ──────────────────────────────────────────────────

@router.get("/admin/about", response_model=LandingAboutResponse)
async def admin_get_about(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingAbout).order_by(LandingAbout.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="About not found")
    return row

@router.put("/admin/about", response_model=LandingAboutResponse)
async def admin_update_about(data: LandingAboutBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingAbout).order_by(LandingAbout.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        row = LandingAbout(id=str(uuid.uuid4()))
        db.add(row)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


# ── Steps ──────────────────────────────────────────────────

@router.get("/admin/steps", response_model=list[LandingStepResponse])
async def admin_get_steps(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingStep).order_by(LandingStep.step_number))
    return result.scalars().all()

@router.post("/admin/steps", response_model=LandingStepResponse, status_code=201)
async def admin_create_step(data: LandingStepBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    row = LandingStep(id=str(uuid.uuid4()), **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.put("/admin/steps/{step_id}", response_model=LandingStepResponse)
async def admin_update_step(step_id: str, data: LandingStepBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingStep).where(LandingStep.id == step_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Step not found")
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/admin/steps/{step_id}", status_code=204)
async def admin_delete_step(step_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingStep).where(LandingStep.id == step_id))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Step not found")
    await db.delete(row)
    await db.commit()


# ── CTA ────────────────────────────────────────────────────

@router.get("/admin/cta", response_model=LandingCTAResponse)
async def admin_get_cta(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingCTA).order_by(LandingCTA.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="CTA not found")
    return row

@router.put("/admin/cta", response_model=LandingCTAResponse)
async def admin_update_cta(data: LandingCTABase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingCTA).order_by(LandingCTA.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        row = LandingCTA(id=str(uuid.uuid4()))
        db.add(row)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


# ── Contact ────────────────────────────────────────────────

@router.get("/admin/contact", response_model=LandingContactResponse)
async def admin_get_contact(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingContact).order_by(LandingContact.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return row

@router.put("/admin/contact", response_model=LandingContactResponse)
async def admin_update_contact(data: LandingContactBase, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(LandingContact).order_by(LandingContact.created_at.desc()).limit(1))
    row = result.scalars().first()
    if not row:
        row = LandingContact(id=str(uuid.uuid4()))
        db.add(row)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row
