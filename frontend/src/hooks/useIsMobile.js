import { useState, useEffect } from 'react';

function useIsMobile() {
  const check = () => {
    const w = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return w < 768 || (isTouch && w < 1024);
  };

  const [isMobile, setIsMobile] = useState(check);

  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(check()), 100);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); };
  }, []);

  return isMobile;
}

export default useIsMobile;
