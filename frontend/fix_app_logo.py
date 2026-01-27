import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Fix BrandMark component to match website exactly (with animation)
old_brandmark = '''// Brand Mark Component - matches website exactly
function BrandMark({ size = 24 }) {
  return (
    <div 
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: '#5B4B8A',
        border: '2px solid #9d8ccf',
        borderRadius: 6,
      }}
    >
      <div 
        className="rounded-full animate-pulse"
        style={{
          width: size * 0.33,
          height: size * 0.33,
          background: '#c4b8e8',
          boxShadow: '0 0 10px rgba(157,140,207,0.5)',
        }}
      />
    </div>
  );
}'''

new_brandmark = '''// Brand Mark Component - matches website exactly
function BrandMark({ size = 24 }) {
  return (
    <div 
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: '#5B4B8A',
        border: '2px solid #9d8ccf',
        borderRadius: 6,
      }}
    >
      <div 
        className="rounded-full"
        style={{
          width: size * 0.33,
          height: size * 0.33,
          background: '#c4b8e8',
          animation: 'eyePulse 7s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes eyePulse {
          0%, 100% { opacity: 0.75; transform: scale(0.98); box-shadow: 0 0 0 rgba(196,184,232,0); }
          50% { opacity: 1; transform: scale(1.02); box-shadow: 0 0 10px rgba(157,140,207,0.22); }
        }
      `}</style>
    </div>
  );
}'''

content = content.replace(old_brandmark, new_brandmark)

# 2. Fix sidebar logo text to match website (IBM Plex Mono, 10px, uppercase, letter-spacing)
old_sidebar_logo = '''<Link to="/dashboard" className="flex items-center gap-3 no-underline">
            <BrandMark size={24} />
            <span style={{fontFamily: "'Inter', sans-serif", fontWeight: 400, color: styles.textPrimary}}>Sentinel Authority</span>
          </Link>'''

new_sidebar_logo = '''<Link to="/dashboard" className="flex items-center gap-3 no-underline">
            <BrandMark size={24} />
            <span style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: styles.textPrimary}}>Sentinel Authority</span>
          </Link>'''

content = content.replace(old_sidebar_logo, new_sidebar_logo)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✓ Fixed App.jsx - BrandMark and sidebar logo now match website")
print("\nDeploy the frontend to see changes.")
