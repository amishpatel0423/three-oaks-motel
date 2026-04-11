import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [loaded, setLoaded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    checkIn: '',
    checkOut: '',
    roomType: 'One Queen'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const handleScroll = () => {
      setScrollPos(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(formData.checkOut) <= new Date(formData.checkIn)) {
      alert("Check-out date must be after check-in date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:8000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          room_preference: formData.roomType,
          check_in_date: formData.checkIn,
          check_out_date: formData.checkOut
        }),
      });
      if (response.ok) {
        setShowSuccess(true);
        setFormData({ name: '', email: '', phone: '', checkIn: '', checkOut: '', roomType: 'One Queen' });
      }
    } catch (error) {
      console.error("Booking error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-sun-white transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-card rounded-none border-t-0 border-x-0 py-4 px-8 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <img src="./images/logo.png" alt="Three Oaks Motel Logo" className="h-16 w-auto hover:scale-105 transition-transform duration-300" />
        </Link>
        <div className="hidden md:flex items-center gap-6 lg:gap-8 transition-all">
          <a href="#about" className="nav-link">About</a>
          <a href="#amenities" className="nav-link hidden lg:block">Amenities</a>
          <a href="#rooms" className="nav-link">Rooms</a>
          <a href="#booking" className="nav-link">Book Now</a>
          <Link to="/gallery" className="nav-link font-bold text-ocean">Gallery</Link>
          <a href="#contact" className="nav-link">Contact</a>
          <Link to="/admin" className="nav-link border-l pl-8 border-slate-200">
            <i className="fas fa-lock mr-2"></i>Admin
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="tel:3212676272" className="hidden sm:flex btn-primary py-2 px-6 text-sm whitespace-nowrap">
            Call Now
          </a>
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center text-slate-800 hover:text-ocean transition-colors focus:outline-none"
          >
            <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        <div className={`fixed inset-0 top-[73px] z-40 md:hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <div className="relative bg-white border-b border-slate-200 px-8 py-10 shadow-xl flex flex-col gap-6">
            <a href="#about" onClick={() => setIsMenuOpen(false)} className="text-xl font-display font-medium text-slate-800 border-b border-slate-50 pb-2">About</a>
            <a href="#amenities" onClick={() => setIsMenuOpen(false)} className="text-xl font-display font-medium text-slate-800 border-b border-slate-50 pb-2">Amenities</a>
            <a href="#rooms" onClick={() => setIsMenuOpen(false)} className="text-xl font-display font-medium text-slate-800 border-b border-slate-50 pb-2">Rooms</a>
            <a href="#booking" onClick={() => setIsMenuOpen(false)} className="text-xl font-display font-medium text-slate-800 border-b border-slate-50 pb-2">Book Now</a>
            <Link to="/gallery" onClick={() => setIsMenuOpen(false)} className="text-xl font-display font-medium text-ocean border-b border-slate-50 pb-2">Photo Gallery</Link>
            <a href="#contact" onClick={() => setIsMenuOpen(false)} className="text-xl font-display font-medium text-slate-800 border-b border-slate-50 pb-2">Contact</a>
            <a href="tel:3212676272" className="btn-primary py-4 text-center text-lg mt-4">
              Call Now
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0 parallax-bg"
          style={{ 
            backgroundImage: 'url("./images/hero.jpg")',
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
          <a href="#booking" className="btn-primary text-lg px-12 py-4">
            Book Your Stay
          </a>
        </div>
      </section>

      {/* About & Amenities Section */}
      <section id="about" className="py-24 px-8 max-w-7xl mx-auto">
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
                { icon: "fa-wifi", text: "Free Fast WiFi" },
                { icon: "fa-parking", text: "Free Parking" },
                { icon: "fa-snowflake", text: "Air Conditioning" },
                { icon: "fa-tv", text: "Cable TV" },
                { icon: "fa-coffee", text: "Daily Coffee" },
                { icon: "fa-rocket", text: "Near Space Center" }
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
      <section id="rooms" className="py-24 px-8 max-w-7xl mx-auto bg-slate-50/50 rounded-3xl mb-12">
        <div className="text-center mb-16">
          <h3 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Our Rooms</h3>
          <div className="w-20 h-1 bg-ocean mx-auto rounded-full" />
          <p className="mt-4 text-slate-600">Premium comfort tailored to your mission.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "One Queen",
              image: "./images/one-queen.jpg", // Reusing copied photos
              price: "Call for Rates",
              desc: "A comfortable queen bed perfect for solo travelers or couples."
            },
            {
              title: "Two Queen",
              image: "./images/two-queen.jpg",
              price: "Call for Rates",
              desc: "Two spacious queen beds, ideal for families or small groups."
            },
            {
              title: "2 Double Bed",
              image: "./images/two-double.jpg", // Using fulls as King for variety
              price: "Call for Rates",
              desc: "Two full beds with a comfortable layout for your stay."
            }
          ].map((room, idx) => (
            <div key={idx} className="glass-card overflow-hidden hover:shadow-2xl transition-shadow duration-500 flex flex-col h-full">
              <div className="h-64 overflow-hidden relative group">
                <img src={room.image} alt={room.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute top-4 right-4 bg-ocean text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  {room.price}
                </div>
              </div>
              <div className="p-8 flex-grow">
                <h4 className="text-2xl font-display font-bold text-slate-800 mb-4">{room.title}</h4>
                <p className="text-slate-600 mb-8 italic">{room.desc}</p>
              </div>
              <div className="p-8 pt-0 mt-auto">
                <a href="#booking" className="btn-primary w-full text-center py-3">Book This Room</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Booking Form Section */}
      <section id="booking" className="py-24 bg-sky-light/50">
        <div className="max-w-4xl mx-auto px-8">
          <div className="glass-card p-8 md:p-12">
            <div className="text-center mb-10">
              <h3 className="text-3xl font-display font-bold text-slate-900 mb-2">Plan Your Stay</h3>
              <p className="text-slate-600">Reserve your room just minutes from the launches.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Guest Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="John Doe"
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/50"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="john@example.com"
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/50"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                  <input 
                    type="tel" 
                    required 
                    placeholder="(321) 555-0000"
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/50"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Room Preference</label>
                  <select 
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-ocean/50"
                    value={formData.roomType}
                    onChange={(e) => setFormData({...formData, roomType: e.target.value})}
                  >
                    <option>One Queen</option>
                    <option>Two Queen</option>
                    <option>King</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Check-in Date</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/50"
                    value={formData.checkIn}
                    onChange={(e) => setFormData({...formData, checkIn: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Check-out Date</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/50"
                    value={formData.checkOut}
                    onChange={(e) => setFormData({...formData, checkOut: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="btn-primary w-full py-4 text-lg mt-4 disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : "Submit Booking Request"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 text-white py-20 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <img src="./images/logo.png" alt="Three Oaks Motel Logo" className="h-12 w-auto mb-6 brightness-0 invert opacity-80" />
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

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
              <i className="fas fa-check"></i>
            </div>
            <h5 className="text-2xl font-display font-bold text-slate-900 mb-4">Reservation Request Received</h5>
            <p className="text-slate-600 mb-8">We will confirm your booking shortly. We look forward to seeing you!</p>
            <button 
              onClick={() => setShowSuccess(false)}
              className="btn-primary w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
