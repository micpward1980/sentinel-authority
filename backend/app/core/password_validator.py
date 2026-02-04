"""Password validation with strength scoring and HaveIBeenPwned breach checking."""
import re
import hashlib
import httpx

COMMON_PASSWORDS = {
    'password', 'password1', 'password123', '123456', '12345678', '123456789',
    'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'login', 'princess',
    'football', 'shadow', 'sunshine', 'trustno1', 'iloveyou', 'batman',
    'access', 'hello', 'charlie', 'donald', '654321', '1234567890',
    'sentinel', 'letmein', 'welcome', 'admin', 'passw0rd', 'qwerty123',
    'p@ssw0rd', 'changeme', 'temp1234', 'zaq1@wsx',
}


def score_password(password: str) -> dict:
    score = 0
    feedback = []
    has_upper = bool(re.search(r'[A-Z]', password))
    has_lower = bool(re.search(r'[a-z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[^A-Za-z0-9]', password))
    if len(password) >= 16: score += 2
    elif len(password) >= 12: score += 1
    variety = sum([has_upper, has_lower, has_digit, has_special])
    if variety >= 4: score += 2
    elif variety >= 3: score += 1
    if len(password) < 12: feedback.append("Use at least 12 characters")
    if not has_upper: feedback.append("Add an uppercase letter")
    if not has_lower: feedback.append("Add a lowercase letter")
    if not has_digit: feedback.append("Add a number")
    if not has_special: feedback.append("Add a special character")
    if password.lower() in COMMON_PASSWORDS:
        score = 0
        feedback = ["This is a commonly used password"]
    score = min(score, 4)
    labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
    colors = ['#D65C5C', '#D6885C', '#D6C35C', '#5CD685', '#5CD685']
    return {'score': score, 'label': labels[score], 'color': colors[score], 'feedback': feedback}


def validate_password_strength(password: str) -> tuple:
    if len(password) < 12:
        return False, "Password must be at least 12 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Must contain at least one number"
    if not re.search(r'[^A-Za-z0-9]', password):
        return False, "Must contain at least one special character"
    if password.lower() in COMMON_PASSWORDS:
        return False, "This password is too common"
    return True, ""


async def check_password_breach(password: str) -> tuple:
    """Check HaveIBeenPwned via k-anonymity. Returns (breached, count). Fails open."""
    sha1 = hashlib.sha1(password.encode()).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f'https://api.pwnedpasswords.com/range/{prefix}')
            if resp.status_code == 200:
                for line in resp.text.splitlines():
                    h, count = line.split(':')
                    if h.strip() == suffix:
                        return True, int(count.strip())
        return False, 0
    except Exception:
        return False, 0
