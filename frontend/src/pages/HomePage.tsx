import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [heroCheckIn, setHeroCheckIn] = useState(today);
  const [heroCheckOut, setHeroCheckOut] = useState(tomorrow);

  useEffect(() => {
    setLoaded(true);
    const handleScroll = () => {
      setScrollPos(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const topOffset = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/booking?check_in=${heroCheckIn}&check_out=${heroCheckOut}`);
  };

  return (
    <div className={`min-h-screen bg-sun-white transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Top Info Banner */}
      <div className="w-full bg-ocean text-white text-xs md:text-sm py-2 px-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center z-[60] relative">
        <span className="flex items-center gap-1.5">
          <i className="fas fa-map-marker-alt opacity-70"></i>
          707 S. Hopkins Ave, Titusville, FL 32780
        </span>
        <span className="hidden sm:block text-white/30">|</span>
        <a href="tel:3212676272" className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
          <i className="fas fa-phone opacity-70"></i>
          (321) 267-6272
        </a>
        <span className="hidden sm:block text-white/30">|</span>
        <span className="flex items-center gap-1.5">
          <i className="fas fa-sign-in-alt opacity-70"></i>
          Check-in: 2:00 PM
        </span>
        <span className="hidden sm:block text-white/30">|</span>
        <span className="flex items-center gap-1.5">
          <i className="fas fa-sign-out-alt opacity-70"></i>
          Check-out: 11:00 AM
        </span>
      </div>

      {/* Navigation */}
      <nav className="fixed top-9 w-full z-50 glass-card rounded-none border-t-0 border-x-0 py-4 px-4 md:px-8 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Three Oaks Motel Logo" className="h-16 w-auto hover:scale-105 transition-transform duration-300" />
        </Link>
        <div className="hidden md:flex items-center gap-6 lg:gap-8 transition-all">
          <a href="#about" onClick={(e) => handleNavClick(e, 'about')} className="nav-link">About</a>
          <a href="#amenities" onClick={(e) => handleNavClick(e, 'amenities')} className="nav-link hidden lg:block">Amenities</a>
          <a href="#rooms" onClick={(e) => handleNavClick(e, 'rooms')} className="nav-link">Rooms</a>
          <a href="#booking" onClick={(e) => handleNavClick(e, 'booking')} className="nav-link">Book Now</a>
          <Link to="/gallery" className="nav-link font-bold text-ocean">Gallery</Link>
          <a href="#contact" onClick={(e) => handleNavClick(e, 'contact')} className="nav-link">Contact</a>
          <Link to="/admin" className="nav-link border-l pl-8 border-slate-200">
            <i className="fas fa-lock mr-2"></i>Admin
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a href="tel:3212676272" className="hidden sm:flex btn-primary py-2 px-6 text-sm whitespace-nowrap">
            Call Now
          </a>
          {/* Mobile Menu Button - Explicitly Z-Indexed */}
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
      </nav>

      {/* Mobile Menu Drawer - Higher Z-Index */}
      <div className={`fixed inset-0 z-[70] md:hidden transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsMenuOpen(false)}></div>
        <div className="relative ml-auto h-full w-[85%] max-w-sm bg-white shadow-2xl flex flex-col p-8 pt-8 gap-6 overflow-y-auto">

          {/* Explicit Close Button inside Drawer */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs uppercase tracking-[0.3em] text-ocean font-bold">Navigation</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-ocean transition-all focus:outline-none bg-slate-50 rounded-full"
              aria-label="Close Menu"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <a href="#about" onClick={(e) => handleNavClick(e, 'about')} className="text-2xl font-display font-medium text-slate-800 border-b border-slate-100 pb-4 hover:text-ocean tracking-tight">About Us</a>
          <a href="#amenities" onClick={(e) => handleNavClick(e, 'amenities')} className="text-2xl font-display font-medium text-slate-800 border-b border-slate-100 pb-4 hover:text-ocean tracking-tight">Amenities</a>
          <a href="#rooms" onClick={(e) => handleNavClick(e, 'rooms')} className="text-2xl font-display font-medium text-slate-800 border-b border-slate-100 pb-4 hover:text-ocean tracking-tight">Guest Rooms</a>
          <a href="#booking" onClick={(e) => handleNavClick(e, 'booking')} className="text-2xl font-display font-medium text-slate-800 border-b border-slate-100 pb-4 hover:text-ocean tracking-tight">Book Now</a>
          <Link to="/gallery" onClick={() => setIsMenuOpen(false)} className="text-2xl font-display font-medium text-ocean border-b border-slate-100 pb-4 tracking-tight flex items-center justify-between">
            Photo Gallery <i className="fas fa-chevron-right text-sm opacity-30"></i>
          </Link>
          <a href="#contact" onClick={(e) => handleNavClick(e, 'contact')} className="text-2xl font-display font-medium text-slate-800 border-b border-slate-100 pb-4 hover:text-ocean tracking-tight">Contact</a>

          <div className="mt-auto pt-8">
            <a href="tel:3212676272" className="btn-primary w-full py-5 text-center text-xl flex items-center justify-center gap-3">
              <i className="fas fa-phone-alt animate-pulse"></i> Call to Book
            </a>
            <p className="text-center text-slate-400 text-xs mt-6 italic">Secure your Space Coast stay today.</p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden pt-9">
        <div
          className="absolute inset-0 z-0 parallax-bg"
          style={{
            backgroundImage: `url("${import.meta.env.BASE_URL}images/hero.jpg")`,
            transform: `translateY(${scrollPos * 0.4}px)`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-sun-white/20 z-10" />

        <div className="relative z-20 text-center text-white px-4 max-w-4xl">
          <h2 className="text-5xl md:text-7xl font-display font-bold mb-6 drop-shadow-lg">
            Welcome to the Space Coast
          </h2>
          <p className="text-xl md:text-2xl font-light mb-10 drop-shadow-md">
            Comfortable, clean, and exactly 20 minutes from the Kennedy Space Center.
          </p>
          {/* Quick Date Search */}
          <form onSubmit={handleHeroSearch} className="flex flex-col sm:flex-row gap-3 justify-center items-end bg-white/15 backdrop-blur-sm rounded-2xl p-4 max-w-xl mx-auto">
            <div className="flex-1 text-left">
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wide mb-1">Check-in</label>
              <input type="date" min={today} value={heroCheckIn} onChange={e => setHeroCheckIn(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-ocean/50 text-sm" />
            </div>
            <div className="flex-1 text-left">
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wide mb-1">Check-out</label>
              <input type="date" min={heroCheckIn || today} value={heroCheckOut} onChange={e => setHeroCheckOut(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-ocean/50 text-sm" />
            </div>
            <button type="submit" className="btn-primary px-6 py-2.5 text-sm whitespace-nowrap">
              Check Availability
            </button>
          </form>
        </div>
      </section>

      {/* About & Amenities Section */}
      <section id="about" className="py-12 px-4 md:py-24 md:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* About */}
          <div>
            <h3 className="text-3xl font-display font-bold text-slate-900 mb-4">About Us</h3>
            <div className="w-16 h-1 bg-ocean rounded-full mb-6" />
            <p className="text-slate-600 leading-relaxed text-lg mb-4">
              Welcome to the Three Oaks Motel, your premier Florida Coastal retreat. Perfectly positioned just minutes away from the legendary Kennedy Space Center, we offer a peaceful and comfortable stay for space enthusiasts, families, and beachgoers alike.
            </p>
            <p className="text-slate-600 leading-relaxed text-lg">
              Experience authentic local hospitality with modern conveniences designed to make your mission a success. Whether you're here to catch a launch or enjoy the sun, we're ready to host you.
            </p>
          </div>

          {/* Amenities */}
          <div id="amenities">
            <h3 className="text-3xl font-display font-bold text-slate-900 mb-4">Property Amenities</h3>
            <div className="w-16 h-1 bg-ocean rounded-full mb-6" />
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              {[
                { icon: "fa-smoking-ban", text: "Non-smoking rooms" },
                { icon: "fa-wifi", text: "Free Wifi" },
                { icon: "fa-parking", text: "Free parking" },
                { icon: "fa-bell-concierge", text: "Room service" },
                { icon: "fa-video", text: "CCTV outside" },
                { icon: "fa-clock", text: "24-hour front desk" },
                { icon: "fa-building", text: "Smoke-free property" },
                { icon: "fa-snowflake", text: "Air conditioning" },
                { icon: "fa-fire", text: "Heating" },
                { icon: "fa-shield-halved", text: "24-hour security" },
                { icon: "fa-bell", text: "Smoke alarms" },
                { icon: "fa-broom", text: "Daily housekeeping" },
                { icon: "fa-fire-extinguisher", text: "Fire extinguishers" },
                { icon: "fa-id-card", text: "Key card access" },
                { icon: "fa-ban", text: "Non-pet friendly" },
                { icon: "fa-chair", text: "Patio" }
              ].map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-3 text-slate-700 hover:text-ocean transition-colors">
                  <div className="w-10 h-10 rounded-full bg-sky-light flex items-center justify-center text-ocean shadow-sm">
                    <i className={`fas ${amenity.icon}`}></i>
                  </div>
                  <span className="font-medium text-sm md:text-base">{amenity.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rooms Section */}
      <section id="rooms" className="py-12 px-4 md:py-24 md:px-8 max-w-7xl mx-auto bg-slate-50/50 rounded-3xl mb-12">
        <div className="text-center mb-16">
          <h3 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Our Rooms</h3>
          <div className="w-20 h-1 bg-ocean mx-auto rounded-full" />
          <p className="mt-4 text-slate-600">Premium comfort tailored to your mission.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "One King",
              image: "./images/one-king.jpg",
              price: "Call for Rates",
              desc: "A spacious king bed perfect for solo travelers or couples."
            },
            {
              title: "Two Queen",
              image: "./images/two-queen.jpg",
              price: "Call for Rates",
              desc: "Two spacious queen beds, ideal for families or small groups."
            },
            {
              title: "2 Double Bed",
              image: "./images/two-double.jpg",
              price: "Call for Rates",
              desc: "Two full beds with a comfortable layout for your stay."
            }
          ].map((room, idx) => (
            <div key={idx} className="glass-card overflow-hidden hover:shadow-2xl transition-shadow duration-500 flex flex-col h-full">
              <div className="h-64 overflow-hidden relative group">
                <img src={`${import.meta.env.BASE_URL}${room.image.replace('./', '')}`} alt={room.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute top-4 right-4 bg-ocean text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  {room.price}
                </div>
              </div>
              <div className="p-8 flex-grow">
                <h4 className="text-2xl font-display font-bold text-slate-800 mb-4">{room.title}</h4>
                <p className="text-slate-600 mb-6 italic">{room.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {["Private bathroom", "Microwave", "Refrigerator", "Cable channels", "Internet", "Linens"].map((item, i) => (
                    <span key={i} className="text-[11px] uppercase tracking-wide font-bold px-2 py-1 bg-sky-light/50 text-ocean rounded block">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-8 pt-0 mt-auto">
                <Link to="/booking" className="btn-primary w-full text-center py-3 block">Book This Room</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* High Ratings / Testimonials Section */}
      <section className="py-16 bg-white border-y border-slate-100 mb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col items-center justify-center text-center mb-12">
            <div className="flex gap-2 text-amber-400 text-xl md:text-2xl mb-4">
              <i className="fas fa-star"></i>
              <i className="fas fa-star"></i>
              <i className="fas fa-star"></i>
              <i className="fas fa-star"></i>
              <i className="fas fa-star"></i>
            </div>
            <h3 className="text-3xl font-display font-bold text-slate-900 mb-3">Top Rated by Guests</h3>
            <p className="text-slate-500 max-w-2xl mx-auto">Consistently applauded for our cleanliness, pristine location, and excellent local hospitality.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl relative shadow-sm">
              <i className="fas fa-quote-left text-4xl text-sky-light/50 absolute top-4 left-4"></i>
              <p className="relative z-10 italic text-slate-700 leading-relaxed">"This is hands down the cleanest motel I've stayed at in Titusville. The owners are incredibly accommodating and the property looks immaculate."</p>
              <span className="block mt-6 font-bold text-sm text-ocean uppercase tracking-wider">- Verified Google Review</span>
            </div>
            <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl relative shadow-sm">
              <i className="fas fa-quote-left text-4xl text-sky-light/50 absolute top-4 left-4"></i>
              <p className="relative z-10 italic text-slate-700 leading-relaxed">"Perfect spot to watch the rocket launches! The location is phenomenal and you're right by the coastline and all the prominent Space Center spots."</p>
              <span className="block mt-6 font-bold text-sm text-ocean uppercase tracking-wider">- Verified Booking Review</span>
            </div>
            <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl relative shadow-sm">
              <i className="fas fa-quote-left text-4xl text-sky-light/50 absolute top-4 left-4"></i>
              <p className="relative z-10 italic text-slate-700 leading-relaxed">"Excellent value. High pressure hot showers, freezing cold AC, and super comfortable beds. Will absolutely book again next time I am in town."</p>
              <span className="block mt-6 font-bold text-sm text-ocean uppercase tracking-wider">- Verified Guest</span>
            </div>
          </div>
        </div>
      </section>


      {/* Book Now CTA Section */}
      <section id="booking" className="py-24 bg-sky-light/50">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="glass-card p-8 md:p-12 text-center">
            <h3 className="text-3xl font-display font-bold text-slate-900 mb-2">Plan Your Stay</h3>
            <p className="text-slate-600 mb-8">Check live availability and pricing — then book in seconds.</p>

            {/* Policy Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center gap-3 bg-sky-light/60 rounded-xl p-4">
                <i className="fas fa-sign-in-alt text-ocean text-lg"></i>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Check-in</p>
                  <p className="text-sm font-semibold text-slate-800">From 2:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-sky-light/60 rounded-xl p-4">
                <i className="fas fa-sign-out-alt text-ocean text-lg"></i>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Check-out</p>
                  <p className="text-sm font-semibold text-slate-800">By 11:00 AM</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-4 border border-amber-100">
                <i className="fas fa-credit-card text-amber-500 text-lg"></i>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Deposit</p>
                  <p className="text-sm font-semibold text-slate-800">Required at check-in</p>
                </div>
              </div>
            </div>

            <Link to="/booking" className="btn-primary text-lg px-12 py-4 inline-block">
              Check Availability &amp; Book
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive Location Map */}
      <section className="w-full h-56 md:h-96 relative">
        <iframe
          title="Three Oaks Motel Location Map"
          src="https://maps.google.com/maps?q=Three+Oaks+Motel,+Titusville&t=&z=15&ie=UTF8&iwloc=&output=embed"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen={true}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full grayscale-[25%] hover:grayscale-0 transition-all duration-[1000ms]"
        ></iframe>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 text-white py-10 px-4 md:py-20 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div>
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Three Oaks Motel Logo" className="h-12 w-auto mb-6 brightness-0 invert opacity-80" />
            <p className="text-slate-400 font-light leading-relaxed">
              Experience the best of Titusville. Comfortable accommodations, friendly service, and the closest views of Florida's legendary launches.
            </p>
          </div>
          <div>
            <h4 className="text-xl font-display font-bold mb-6">Location</h4>
            <p className="text-slate-400 font-light flex items-center gap-3">
              <i className="fas fa-map-marker-alt text-ocean"></i>
              707 S. Hopkins Ave, Titusville, FL 32780
            </p>
          </div>
          <div>
            <h4 className="text-xl font-display font-bold mb-6">Contact</h4>
            <div className="space-y-4">
              <a href="tel:3212676272" className="text-slate-400 font-light flex items-center gap-3 hover:text-white transition-colors">
                <i className="fas fa-phone text-ocean"></i>
                (321) 267-6272
              </a>
              <a href="mailto:threeoaksmotel707@gmail.com" className="text-slate-400 font-light flex items-center gap-3 hover:text-white transition-colors">
                <i className="fas fa-envelope text-ocean"></i>
                threeoaksmotel707@gmail.com
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-slate-800 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Three Oaks Motel. All Rights Reserved.
        </div>
      </footer>

    </div>
  );
}
