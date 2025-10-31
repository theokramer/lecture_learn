import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint: number = 1024): boolean {
  // Initialize as false to prevent SSR/hydration mismatches
  // Will be set correctly on first client-side render
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setHasMounted(true);
    
    const checkIsMobile = () => {
      try {
        setIsMobile(window.innerWidth < breakpoint);
      } catch (error) {
        // Fallback to false if there's any error
        setIsMobile(false);
      }
    };

    // Set initial value
    checkIsMobile();

    const handleResize = () => {
      checkIsMobile();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  // Return false until mounted to prevent hydration issues
  if (!hasMounted) return false;
  
  return isMobile;
}

