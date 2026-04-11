import { useEffect, useState } from 'react';
import './RocketLaunch.css';

export default function RocketLaunch() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check if we have already shown the intro in this session
    const hasSeenIntro = sessionStorage.getItem('hasSeenRocketIntro');
    
    if (!hasSeenIntro) {
      // Setup animation to play
      setIsVisible(true);
      setIsAnimating(true);
      sessionStorage.setItem('hasSeenRocketIntro', 'true');
      
      // Cleanup after rocket clears the screen
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => setIsVisible(false), 500); // fade out gracefully
      }, 3500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-[100] pointer-events-none transition-opacity duration-500 flex justify-center overflow-hidden ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
      <div className="rocket-container absolute bottom-0 left-1/2 transform -translate-x-1/2">
        <div className="relative">
          <img 
            src={`${import.meta.env.BASE_URL}images/rocket.png`} 
            alt="Rocket Launch" 
            className="rocket-image relative z-10 w-48 md:w-64 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          />
          {/* Engine Flames */}
          <div className="flame-container absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex justify-center z-0">
            <div className="flame-core w-4 h-16 bg-yellow-100 rounded-full opacity-90 blur-sm mix-blend-screen animate-pulse"></div>
            <div className="flame-outer absolute top-2 w-8 h-24 bg-orange-500 rounded-full opacity-70 blur-md mix-blend-screen animate-flicker"></div>
            <div className="flame-halo absolute top-4 w-16 h-32 bg-red-600 rounded-full opacity-50 blur-xl mix-blend-screen"></div>
          </div>
          
          {/* Smoke Puffs */}
          <div className="smoke-container absolute -bottom-[70px] left-1/2 transform -translate-x-1/2 w-48 h-48 opacity-60 z-[-1] pointer-events-none">
             <div className="smoke-puff puff-1"></div>
             <div className="smoke-puff puff-2"></div>
             <div className="smoke-puff puff-3"></div>
             <div className="smoke-puff puff-4"></div>
             <div className="smoke-puff puff-5"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
