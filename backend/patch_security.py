#!/usr/bin/env python3
"""
Security enhancements for Sentinel Authority backend
- Rate limiting on auth endpoints
- Password strength validation
- Account lockout after failed attempts
"""

# ============================================
# 1. Install slowapi for rate limiting
# ============================================
# Add to requirements.txt: slowapi==0.1.9

REQUIREMENTS_ADDITION = "slowapi==0.1.9"

# ============================================
# 2. Add to main.py - Rate limiting setup
# ============================================

MAIN_PY_ADDITIONS = '''
# Add these imports at top of main.py:
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Add after app = FastAPI(...):
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
'''

# ============================================
# 3. Add to auth.py - Rate limited endpoints
# ============================================

AUTH_PY_CHANGES = '''
# Add import at top:
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

# Change the login endpoint decorator to:
@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")  # 5 attempts per minute
async def login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    # ... existing code

# Change the register endpoint decorator to:
@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")  # 3 registrations per minute
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # ... existing code

# Change forgot-password to:
@router.post("/forgot-password")
@limiter.limit("3/minute")  # 3 reset requests per minute
async def forgot_password(request: Request, req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    # ... existing code
'''

# ============================================
# 4. Password strength validation
# ============================================

PASSWORD_VALIDATION = '''
import re

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets security requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\\d", password):
        return False, "Password must contain at least one number"
    return True, ""

# Add to register endpoint before creating user:
valid, msg = validate_password_strength(user_data.password)
if not valid:
    raise HTTPException(status_code=400, detail=msg)
'''

# ============================================
# 5. Account lockout (add columns to User model)
# ============================================

MODEL_ADDITIONS = '''
    # Add to User model in models.py:
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
'''

LOCKOUT_LOGIC = '''
# Add to login endpoint after fetching user:

# Check if account is locked
if user.locked_until and user.locked_until > datetime.utcnow():
    minutes_left = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
    raise HTTPException(
        status_code=429, 
        detail=f"Account locked. Try again in {minutes_left} minutes."
    )

# On failed login:
if not user or not verify_password(credentials.password, user.hashed_password):
    if user:
        user.failed_login_attempts += 1
        # Lock after 5 failed attempts for 15 minutes
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=15)
        await db.commit()
    raise HTTPException(status_code=401, detail="Invalid credentials")

# On successful login, reset counter:
user.failed_login_attempts = 0
user.locked_until = None
await db.commit()
'''

# ============================================
# 6. SQL Migration for lockout
# ============================================

MIGRATION_SQL = """
-- Add account lockout columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
"""


def patch_files(backend_dir):
    """Apply security patches to backend files"""
    import os
    
    # 1. Add slowapi to requirements.txt
    req_path = os.path.join(backend_dir, "requirements.txt")
    with open(req_path, 'r') as f:
        reqs = f.read()
    if 'slowapi' not in reqs:
        with open(req_path, 'a') as f:
            f.write('\nslowapi==0.1.9\n')
        print("✓ Added slowapi to requirements.txt")
    else:
        print("⚠ slowapi already in requirements.txt")
    
    # 2. Patch main.py for rate limiting
    main_path = os.path.join(backend_dir, "main.py")
    with open(main_path, 'r') as f:
        main_content = f.read()
    
    if 'slowapi' not in main_content:
        # Add imports
        main_content = main_content.replace(
            'from fastapi import FastAPI',
            '''from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded'''
        )
        
        # Add limiter setup after app creation
        main_content = main_content.replace(
            'app = FastAPI(',
            '''limiter = Limiter(key_func=get_remote_address)

app = FastAPI('''
        )
        
        # Add exception handler after CORS middleware
        main_content = main_content.replace(
            'app.add_middleware(\n    CORSMiddleware,',
            '''app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,'''
        )
        
        with open(main_path, 'w') as f:
            f.write(main_content)
        print("✓ Added rate limiting to main.py")
    else:
        print("⚠ Rate limiting already in main.py")
    
    # 3. Patch auth.py for rate limits and password validation
    auth_path = os.path.join(backend_dir, "app/api/routes/auth.py")
    with open(auth_path, 'r') as f:
        auth_content = f.read()
    
    if 'limiter.limit' not in auth_content:
        # Add imports
        auth_content = auth_content.replace(
            'from fastapi import APIRouter, Depends, HTTPException, status',
            '''from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import re'''
        )
        
        # Add limiter and password validation
        auth_content = auth_content.replace(
            'router = APIRouter()',
            '''router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def validate_password_strength(password: str) -> tuple:
    """Validate password meets security requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\\d", password):
        return False, "Password must contain at least one number"
    return True, ""'''
        )
        
        # Add rate limit to register
        auth_content = auth_content.replace(
            '@router.post("/register", response_model=TokenResponse)\nasync def register(user_data: UserCreate',
            '''@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate'''
        )
        
        # Add rate limit to login
        auth_content = auth_content.replace(
            '@router.post("/login", response_model=TokenResponse)\nasync def login(credentials: UserLogin',
            '''@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin'''
        )
        
        # Add rate limit to forgot-password
        auth_content = auth_content.replace(
            '@router.post("/forgot-password")\nasync def forgot_password(request: ForgotPasswordRequest',
            '''@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, req: ForgotPasswordRequest'''
        )
        
        # Fix the variable name in forgot_password
        auth_content = auth_content.replace(
            'select(User).where(User.email == request.email)',
            'select(User).where(User.email == req.email)'
        )
        
        # Add password validation to register (after checking email exists)
        auth_content = auth_content.replace(
            'if result.scalar_one_or_none():\n        raise HTTPException(status_code=400, detail="Email already registered")\n    \n    user = User(',
            '''if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength
    valid, msg = validate_password_strength(user_data.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    
    user = User('''
        )
        
        with open(auth_path, 'w') as f:
            f.write(auth_content)
        print("✓ Added rate limiting and password validation to auth.py")
    else:
        print("⚠ Rate limiting already in auth.py")
    
    # 4. Patch models.py for lockout columns
    models_path = os.path.join(backend_dir, "app/models/models.py")
    with open(models_path, 'r') as f:
        models_content = f.read()
    
    if 'failed_login_attempts' not in models_content:
        models_content = models_content.replace(
            'reset_token_expires = Column(DateTime, nullable=True)',
            '''reset_token_expires = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)'''
        )
        
        with open(models_path, 'w') as f:
            f.write(models_content)
        print("✓ Added lockout columns to models.py")
    else:
        print("⚠ Lockout columns already in models.py")


if __name__ == "__main__":
    import sys
    import os
    
    backend_dir = os.path.expanduser("~/Downloads/sentinel-authority/backend")
    if len(sys.argv) > 1:
        backend_dir = sys.argv[1]
    
    print("Applying security enhancements...")
    print("=" * 50)
    
    patch_files(backend_dir)
    
    print("=" * 50)
    print("\nRun this SQL on your Railway database:")
    print(MIGRATION_SQL)
    print("\nThen deploy:")
    print("  cd ~/Downloads/sentinel-authority/backend")
    print("  pip install slowapi  # if testing locally")
    print("  git add . && git commit -m 'Add security enhancements' && git push")
