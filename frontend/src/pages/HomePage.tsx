import { useState, useEffect } from 'react';
import { Rocket, Satellite, Send, Calendar, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [showAnimation, setShowAnimation] = useState(true);
  const [bookingFormData, setBookingFormData] = useState({
    guest_name: '',
    email: '',
    phone: '',
    room_preference: 'Apollo Standard',
    check_in_date: '',
    check_out_date: ''
  });
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  useEffect(() => {
    // Hide animation after 3 seconds
    const timer = setTimeout(() => setShowAnimation(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setBookingFormData({ ...bookingFormData, [e.target.name]: e.target.value });
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(bookingFormData.check_out_date) <= new Date(bookingFormData.check_in_date)) {
      alert("Check-out date must be after check-in date.");
      return;
    }
    setBookingStatus('submitting');
    
    try {
        const res = await fetch('http://localhost:8000/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingFormData)
        });
        if (res.ok) {
            setBookingStatus('success');
            setBookingFormData({
                guest_name: '', email: '', phone: '', room_preference: 'Apollo Standard', check_in_date: '', check_out_date: ''
            });
            setTimeout(() => setBookingStatus('idle'), 5000);
        } else {
            console.error("Failed to submit");
            setBookingStatus('idle');
        }
    } catch(err) {
        console.error(err);
        setBookingStatus('idle');
    }
  };

  if (showAnimation) {
    return (
      <div className="fixed inset-0 bg-nasa-blue flex flex-col items-center justify-end z-[9999] overflow-hidden">
        <div className="text-white text-4xl font-orbitron mb-8 animate-pulse text-center">T-MINUS 3...</div>
        <div className="animate-shuttle-launch flex flex-col items-center">
            <Rocket size={120} className="text-white drop-shadow-2xl mb-4" />
            <div className="w-10 h-32 bg-gradient-to-b from-orange-400 via-yellow-200 to-transparent blur-md rounded-full"></div>
            <div className="w-full absolute bottom-[-50px] flex justify-center space-x-10 opacity-70">
                <div className="w-40 h-40 bg-white rounded-full blur-3xl mix-blend-overlay"></div>
                <div className="w-60 h-60 bg-white rounded-full blur-3xl mix-blend-overlay"></div>
                <div className="w-40 h-40 bg-white rounded-full blur-3xl mix-blend-overlay"></div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animate-fade-in flex flex-col">
      {/* Navigation Layer */}
      <nav className="fixed top-0 w-full glass-panel z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-nasa-dark">
            <Satellite size={28} />
            <span className="font-orbitron font-bold text-xl tracking-wider">THREE OAKS MOTEL</span>
          </div>
          <div className="hidden md:flex space-x-6">
            <a href="#habitat" className="text-sm font-bold tracking-wider hover:text-nasa-orange transition-colors">HABITAT MODULES</a>
            <a href="#reserve" className="text-sm font-bold tracking-wider hover:text-nasa-orange transition-colors">RESERVE</a>
            <Link to="/admin" className="text-sm font-bold tracking-wider hover:text-nasa-orange transition-colors">MISSION CONTROL</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background Video Fallback / Styling */}
        <div className="absolute inset-0 z-0 bg-nasa-blue flex items-center justify-center pointer-events-none">
            {/* The actual video would go here if provided in public folder */}
            <video autoPlay loop muted playsInline className="absolute min-w-full min-h-full object-cover mix-blend-overlay opacity-80">
                <source src="/pictures/launch.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-nasa-blue/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 text-center px-4">
          <h1 className="text-5xl md:text-7xl text-white mb-4 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]">
            Comfort on the Space Coast.
          </h1>
          <p className="text-xl md:text-2xl text-nasa-light mb-8 font-light drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] max-w-2xl mx-auto">
            Your Home Before Liftoff. Precisely 20 minutes from the KSC Launchpad.
          </p>
          <a href="#reserve" className="btn-primary inline-block">INITIATE RESERVATION SEQUENCE</a>
        </div>
      </section>

      {/* Habitat Modules (The Fleet) */}
      <section id="habitat" className="py-20 bg-nasa-light relative z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl text-nasa-dark mb-2">THE FLEET</h2>
            <p className="text-slate-500 font-medium tracking-widest text-sm">HABITAT MODULES</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Apollo Standard */}
            <div className="bg-white rounded-lg p-6 shadow-lg border-t-4 border-slate-300 hover:shadow-xl transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-slate-300 text-xs font-bold px-3 py-1 text-slate-700 tracking-wider">STANDARD</div>
                <h3 className="text-2xl text-nasa-dark mt-4 mb-2">Apollo</h3>
                <ul className="text-slate-600 mb-6 space-y-2 text-sm font-medium">
                    <li>✓ 1 Queen Bed</li>
                    <li>✓ Basic Amenities</li>
                    <li>✓ Telemetry Wi-Fi</li>
                </ul>
            </div>
            {/* Gemini Deluxe */}
            <div className="bg-white rounded-lg p-6 shadow-lg border-t-4 border-nasa-blue hover:shadow-xl transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-nasa-blue text-xs font-bold px-3 py-1 text-white tracking-wider">DELUXE</div>
                <h3 className="text-2xl text-nasa-dark mt-4 mb-2">Gemini</h3>
                <ul className="text-slate-600 mb-6 space-y-2 text-sm font-medium">
                    <li>✓ 2 Queen Beds</li>
                    <li>✓ Upgraded Amenities</li>
                    <li>✓ Enhanced Telemetry Wi-Fi</li>
                </ul>
            </div>
            {/* Artemis Suite */}
            <div className="bg-white rounded-lg p-6 shadow-lg border-t-4 border-nasa-orange hover:shadow-xl transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-nasa-orange text-xs font-bold px-3 py-1 text-white tracking-wider">SUITE</div>
                <h3 className="text-2xl text-nasa-dark mt-4 mb-2">Artemis</h3>
                <ul className="text-slate-600 mb-6 space-y-2 text-sm font-medium">
                    <li>✓ 1 King Bed</li>
                    <li>✓ Living Area Module</li>
                    <li>✓ Premium Amenities</li>
                </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Form (Mission Briefing) */}
      <section id="reserve" className="py-20 bg-slate-900 text-white relative z-20">
        <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-4xl text-white mb-2">MISSION BRIEFING</h2>
                <p className="text-blue-300 font-medium tracking-widest text-sm">LAUNCH CONTROL CONSOLE</p>
            </div>

            {bookingStatus === 'success' ? (
                <div className="bg-green-900/40 border border-green-500 rounded-lg p-10 text-center animate-fade-in">
                    <CheckCircle size={60} className="text-green-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-orbitron text-green-300 mb-2">Transmission Received.</h3>
                    <p className="text-green-100">Awaiting Mission Control Approval. Stand by.</p>
                </div>
            ) : (
                <form onSubmit={handleBookingSubmit} className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl relative">
                    <div className="absolute top-4 left-4 flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-xs font-orbitron text-nasa-blue mb-1 tracking-wider uppercase">Commander (Name)</label>
                            <input required type="text" name="guest_name" value={bookingFormData.guest_name} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white focus:outline-none focus:border-nasa-blue focus:ring-1 focus:ring-nasa-blue" />
                        </div>
                        <div>
                            <label className="block text-xs font-orbitron text-nasa-blue mb-1 tracking-wider uppercase">Comms Link (Email)</label>
                            <input required type="email" name="email" value={bookingFormData.email} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white focus:outline-none focus:border-nasa-blue focus:ring-1 focus:ring-nasa-blue" />
                        </div>
                        <div>
                            <label className="block text-xs font-orbitron text-nasa-blue mb-1 tracking-wider uppercase">Sub-space Freq (Phone)</label>
                            <input required type="text" name="phone" value={bookingFormData.phone} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white focus:outline-none focus:border-nasa-blue focus:ring-1 focus:ring-nasa-blue" />
                        </div>
                        <div>
                            <label className="block text-xs font-orbitron text-nasa-blue mb-1 tracking-wider uppercase">Module Preference</label>
                            <select name="room_preference" value={bookingFormData.room_preference} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white focus:outline-none focus:border-nasa-blue focus:ring-1 focus:ring-nasa-blue">
                                <option value="Apollo Standard">Apollo Standard</option>
                                <option value="Gemini Deluxe">Gemini Deluxe</option>
                                <option value="Artemis Suite">Artemis Suite</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-orbitron text-nasa-blue mb-1 tracking-wider uppercase">Check-in Sequence</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input required type="date" name="check_in_date" value={bookingFormData.check_in_date} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded pl-10 pr-4 py-2 text-white focus:outline-none focus:border-nasa-blue focus:ring-1 focus:ring-[color-nasa-blue]" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-orbitron text-nasa-blue mb-1 tracking-wider uppercase">Check-out Sequence</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input required type="date" name="check_out_date" value={bookingFormData.check_out_date} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded pl-10 pr-4 py-2 text-white focus:outline-none focus:border-nasa-blue focus:ring-1 focus:ring-nasa-blue" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 text-center pt-6 border-t border-slate-700">
                        <button type="submit" disabled={bookingStatus === 'submitting'} className="btn-primary w-full md:w-auto flex items-center justify-center space-x-2 disabled:opacity-50 mx-auto">
                            <Send size={18} />
                            <span>{bookingStatus === 'submitting' ? 'TRANSMITTING...' : 'SUBMIT DIRECTIVE'}</span>
                        </button>
                    </div>
                </form>
            )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-10 text-center relative z-20">
        <div className="max-w-4xl mx-auto px-4 font-mono text-sm">
            <div className="flex justify-center items-center mb-6 text-nasa-blue">
                <Satellite size={32} />
            </div>
            <p className="tracking-widest uppercase mb-4">THREE OAKS MOTEL - LAUNCH FACILITY</p>
            <p>707 S. Hopkins Ave, Titusville, FL 32780</p>
            <p>(321) 267-6272 | threeoaksmotel707@gmail.com</p>
            <p className="mt-8 text-xs opacity-50">© {new Date().getFullYear()} Three Oaks Motel. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
