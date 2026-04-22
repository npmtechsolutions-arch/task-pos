"""Add tenant_id to HR records (candidates, interns, leaves).

Revision ID: 8f3b2c2d19a1
Revises: 5a25e5c4c723
Create Date: 2026-04-21

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8f3b2c2d19a1"
down_revision = "5a25e5c4c723"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns (nullable for safe rollout/backfill)
    op.add_column("candidates", sa.Column("tenant_id", sa.String(length=36), nullable=True))
    op.add_column("interns", sa.Column("tenant_id", sa.String(length=36), nullable=True))
    op.add_column("leaves", sa.Column("tenant_id", sa.String(length=36), nullable=True))

    # Indexes
    op.create_index(op.f("ix_candidates_tenant_id"), "candidates", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_interns_tenant_id"), "interns", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_leaves_tenant_id"), "leaves", ["tenant_id"], unique=False)

    # Foreign keys
    op.create_foreign_key(
        op.f("fk_candidates_tenant_id_tenants"),
        "candidates",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("fk_interns_tenant_id_tenants"),
        "interns",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("fk_leaves_tenant_id_tenants"),
        "leaves",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Backfill from related users where possible
    op.execute(
        """
        UPDATE candidates c
        SET tenant_id = u.tenant_id
        FROM users u
        WHERE c.tenant_id IS NULL
          AND c.created_by_id = u.id
        """
    )
    op.execute(
        """
        UPDATE leaves l
        SET tenant_id = u.tenant_id
        FROM users u
        WHERE l.tenant_id IS NULL
          AND l.user_id = u.id
        """
    )
    op.execute(
        """
        UPDATE interns i
        SET tenant_id = u.tenant_id
        FROM users u
        WHERE i.tenant_id IS NULL
          AND i.mentor_id = u.id
        """
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_leaves_tenant_id_tenants"), "leaves", type_="foreignkey")
    op.drop_constraint(op.f("fk_interns_tenant_id_tenants"), "interns", type_="foreignkey")
    op.drop_constraint(op.f("fk_candidates_tenant_id_tenants"), "candidates", type_="foreignkey")

    op.drop_index(op.f("ix_leaves_tenant_id"), table_name="leaves")
    op.drop_index(op.f("ix_interns_tenant_id"), table_name="interns")
    op.drop_index(op.f("ix_candidates_tenant_id"), table_name="candidates")

    op.drop_column("leaves", "tenant_id")
    op.drop_column("interns", "tenant_id")
    op.drop_column("candidates", "tenant_id")

