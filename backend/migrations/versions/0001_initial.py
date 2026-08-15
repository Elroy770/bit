from alembic import op
import sqlalchemy as sa
revision="0001_initial"; down_revision=None; branch_labels=None; depends_on=None
def upgrade():
    op.create_table("transactions",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("name",sa.String(120),nullable=False),sa.Column("phone",sa.String(30),nullable=False),sa.Column("amount",sa.Numeric(12,2),nullable=False),sa.Column("paid_amount",sa.Numeric(12,2),nullable=False,server_default="0"),sa.Column("note",sa.Text()),sa.Column("receipt_path",sa.String(255)),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False))
    op.create_index("ix_transactions_phone","transactions",["phone"]); op.create_index("ix_transactions_created_at","transactions",["created_at"])
def downgrade():
    op.drop_table("transactions")
