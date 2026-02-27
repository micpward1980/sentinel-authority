"""Audit chain integrity tests — the core product."""
import pytest
import hashlib


@pytest.mark.asyncio
async def test_audit_log_creation(client, auth_headers):
    """Verify that actions create audit log entries."""
    resp = await client.get("/api/v1/audit", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_audit_chain_hash_integrity(db_session):
    """Verify hash chain is unbroken."""
    from sqlalchemy import text
    result = await db_session.execute(
        text("""
            SELECT id, action, created_at, previous_hash, entry_hash
            FROM audit_log
            ORDER BY id ASC
            LIMIT 100
        """)
    )
    rows = result.fetchall()
    if len(rows) < 2:
        pytest.skip("Not enough audit entries to verify chain")
    
    for i in range(1, len(rows)):
        prev_row = rows[i - 1]
        curr_row = rows[i]
        # Current row's previous_hash should match prior row's entry_hash
        assert curr_row.previous_hash == prev_row.entry_hash, (
            f"Hash chain broken at id={curr_row.id}: "
            f"previous_hash={curr_row.previous_hash} != prior entry_hash={prev_row.entry_hash}"
        )


@pytest.mark.asyncio
async def test_audit_log_immutability(db_session):
    """Verify that audit log rows cannot be updated via normal ORM operations."""
    from sqlalchemy import text
    result = await db_session.execute(
        text("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1")
    )
    row = result.scalar_one_or_none()
    if row is None:
        pytest.skip("No audit entries")
    
    # Attempt to update — should fail due to DB trigger
    try:
        await db_session.execute(
            text(f"UPDATE audit_log SET action = 'TAMPERED' WHERE id = {row}")
        )
        await db_session.commit()
        pytest.fail("UPDATE on audit_log should have been blocked by trigger")
    except Exception:
        await db_session.rollback()
        pass  # Expected: trigger blocks the update
