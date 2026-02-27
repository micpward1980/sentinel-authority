"""
Automated database backup script.
Run via cron or Railway scheduled job.
Dumps Postgres to timestamped SQL file and uploads to S3 if configured.
"""
import os
import subprocess
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [BACKUP] %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/tmp/backups")
S3_BUCKET = os.environ.get("BACKUP_S3_BUCKET", "")
RETENTION_DAYS = int(os.environ.get("BACKUP_RETENTION_DAYS", "30"))


def parse_db_url(url: str) -> dict:
    from urllib.parse import urlparse
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "user": p.username,
        "password": p.password,
        "dbname": p.path.lstrip("/"),
    }


def run_backup():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        return False

    os.makedirs(BACKUP_DIR, exist_ok=True)
    db = parse_db_url(DATABASE_URL)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"sentinel_backup_{timestamp}.sql.gz"
    filepath = os.path.join(BACKUP_DIR, filename)

    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    cmd = [
        "pg_dump",
        "-h", db["host"],
        "-p", str(db["port"]),
        "-U", db["user"],
        "-d", db["dbname"],
        "--no-owner",
        "--no-acl",
        "-Fc",
    ]

    try:
        with open(filepath, "wb") as f:
            result = subprocess.run(cmd, env=env, stdout=f, stderr=subprocess.PIPE, timeout=300)

        if result.returncode != 0:
            logger.error(f"pg_dump failed: {result.stderr.decode()}")
            return False

        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        logger.info(f"Backup complete: {filename} ({size_mb:.1f} MB)")

        if S3_BUCKET:
            upload_to_s3(filepath, filename)

        clean_old_backups()
        return True

    except subprocess.TimeoutExpired:
        logger.error("pg_dump timed out after 300s")
        return False
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        return False


def upload_to_s3(filepath: str, filename: str):
    try:
        import boto3
        s3 = boto3.client("s3")
        key = f"backups/sentinel/{filename}"
        s3.upload_file(filepath, S3_BUCKET, key)
        logger.info(f"Uploaded to s3://{S3_BUCKET}/{key}")
    except ImportError:
        logger.warning("boto3 not installed - skipping S3 upload")
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")


def clean_old_backups():
    import glob
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    for f in glob.glob(os.path.join(BACKUP_DIR, "sentinel_backup_*.sql.gz")):
        try:
            parts = os.path.basename(f).replace("sentinel_backup_", "").replace(".sql.gz", "")
            file_date = datetime.strptime(parts, "%Y%m%d_%H%M%S")
            if file_date < cutoff:
                os.remove(f)
                logger.info(f"Removed old backup: {os.path.basename(f)}")
        except (IndexError, ValueError):
            pass


if __name__ == "__main__":
    success = run_backup()
    exit(0 if success else 1)
