import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { galleryImages } from '../data/galleryAssets';

export default function GalleryPage() {
  const [loaded, setLoaded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setLoaded(true);
    window.scrollTo(0, 0); // Start at top of page on route switch
  }, []);

  return (
    <div className={`min-h-screen bg-sky-light/30 transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 py-4 px-8 flex justify-between items-center shadow-sm">
        <Link to="/" className="flex items-center">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Three Oaks Motel Logo" className="h-14 w-auto drop-shadow-sm hover:scale-105 transition-transform duration-300" />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="nav-link hidden md:block font-bold text-slate-600 hover:text-ocean transition-colors">Return to Home</Link>
          <a href="tel:3212676272" className="hidden sm:flex btn-primary py-2 px-6 text-sm shadow-md hover:-translate-y-1 transition-transform">Call Now</a>
          
          {/* Mobile Menu Button - High Z-Index */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="md:hidden w-12 h-12 flex items-center justify-center text-slate-800 hover:text-ocean transition-all focus:outline-none relative z-[60]"
            aria-label="Toggle Menu"
          >
            <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-2xl`}></i>
          </button>
        </div>

        {/* Mobile Menu Drawer - Premium Overlay */}
        <div className={`fixed inset-0 z-[70] md:hidden transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsMenuOpen(false)}></div>
          <div className="relative ml-auto h-full w-[85%] max-w-sm bg-white shadow-2xl flex flex-col p-8 pt-8 gap-6 overflow-y-auto">
            
            {/* Explicit Close Button inside Drawer */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs uppercase tracking-[0.3em] text-ocean font-bold">Portfolio</h2>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-ocean transition-all focus:outline-none bg-slate-50 rounded-full"
                aria-label="Close Menu"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-2xl font-display font-medium text-slate-800 border-b border-slate-100 pb-4 hover:text-ocean tracking-tight">Home</Link>
            <div className="mt-auto pt-8">
              <a href="tel:3212676272" className="btn-primary w-full py-5 text-center text-xl flex items-center justify-center gap-3">
                <i className="fas fa-phone-alt animate-pulse"></i> Call Now
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-36 pb-16 px-8 max-w-7xl mx-auto text-center animate-fade-up">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-6 drop-shadow-sm">Photo Gallery</h2>
        <div className="w-24 h-1.5 bg-gradient-to-r from-ocean to-cyan-400 mx-auto rounded-full mb-6 shadow-sm" />
        <p className="text-slate-600 text-lg font-light">Explore our facilities perfectly situated for your Space Coast mission.</p>
      </section>

      {/* Masonry Grid */}
      <section className="px-4 md:px-8 pb-32 max-w-[90rem] mx-auto">
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
          {galleryImages.map((img, idx) => (
            <div key={idx} className="break-inside-avoid overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 group relative">
              <img 
                src={`${import.meta.env.BASE_URL}images/gallery/${img}`} 
                alt={`Three Oaks Motel Gallery Photo ${idx + 1}`} 
                loading="lazy"
                className="w-full h-auto object-cover transform group-hover:scale-[1.03] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end justify-center pb-6">
                <span className="text-white font-bold tracking-wide italic scale-90 group-hover:scale-100 transition-transform duration-500 delay-100">Three Oaks View</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-8 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} Three Oaks Motel. All Rights Reserved.
      </footer>
    </div>
  );
}
