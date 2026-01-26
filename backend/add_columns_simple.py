import psycopg2

conn = psycopg2.connect(
    host="ep-late-shape-ah6v1szf-pooler.c-3.us-east-1.aws.neon.tech",
    database="neondb",
    user="neondb_owner",
    password="npg_2Jmst3rvlnxI",
    sslmode="require"
)

cur = conn.cursor()
cur.execute("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signature VARCHAR(50)")
cur.execute("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS audit_log_ref VARCHAR(50)")
conn.commit()
cur.close()
conn.close()
print("Columns added successfully")
