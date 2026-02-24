import { useState, useEffect } from 'react';

function useIsMobile() {
  const check = () => {
    // Catch phones in both orientations:
    // - Portrait: width < 768
    // - Landscape: width < 1024 AND touch device
    const w = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return w < 768 || (isTouch && w < 1024);
  };

  const [isMobile, setIsMobile] = useState(check);

  useEffect(() => {
    const handleResize = () => setIsMobile(check());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export default useIsMobile;
