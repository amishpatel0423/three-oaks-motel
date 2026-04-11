import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { galleryImages } from '../data/galleryAssets';

export default function GalleryPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    window.scrollTo(0, 0); // Start at top of page on route switch
  }, []);

  return (
    <div className={`min-h-screen bg-sky-light/30 transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 py-4 px-8 flex justify-between items-center shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-ocean rounded-lg flex items-center justify-center text-white shadow-md">
            <i className="fas fa-umbrella-beach"></i>
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-800">Three Oaks</h1>
            <p className="text-[10px] tracking-[0.2em] text-ocean font-bold uppercase">Florida Coastal</p>
          </div>
        </Link>
        <div className="flex items-center gap-8">
          <Link to="/" className="nav-link hidden md:block font-bold text-slate-600 hover:text-ocean transition-colors">Return to Home</Link>
          <a href="tel:3212676272" className="btn-primary py-2 px-6 text-sm shadow-md hover:-translate-y-1 transition-transform">Call Now</a>
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
                src={`./images/gallery/${img}`} 
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
