import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Check, CalendarDays, Moon, CreditCard } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ROOM_INFO: Record<string, { image: string; desc: string }> = {
  'One King': {
    image: 'images/one-king.jpg',
    desc: 'A spacious king (or queen) bed — perfect for solo travelers or couples seeking extra comfort.',
  },
  'Two Queen': {
    image: 'images/two-queen.jpg',
    desc: 'Two spacious queen beds — ideal for families or small groups.',
  },
  '2 Double Bed': {
    image: 'images/two-double.jpg',
    desc: 'Two full beds with a comfortable layout, great for any group.',
  },
};

interface NightlyPrice {
  date: string;
  price: number;
}

interface CategoryAvailability {
  category: string;
  available_count: number;
  room_numbers: string[];
  nightly_prices: NightlyPrice[];
  total_price: number;
}

interface GuestInfo {
  name: string;
  email: string;
  phone: string;
  adults: number;
  kids: number;

  specialRequests: string;
}

type Step = 'search' | 'results' | 'checkout' | 'confirmed';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function nightCount(checkIn: string, checkOut: string): number {
  return Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
}

export default function BookingPage() {
  const localDate = (d: Date) => { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };
  const today = localDate(new Date());
  const tomorrow = localDate(new Date(Date.now() + 86400000));

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [step, setStep] = useState<Step>('search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<CategoryAvailability[]>([]);
  const [selected, setSelected] = useState<CategoryAvailability | null>(null);
  const [guest, setGuest] = useState<GuestInfo>({ name: '', email: '', phone: '', adults: 1, kids: 0, specialRequests: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState<number | null>(null);
  const [confirmedRef, setConfirmedRef] = useState<string>('');
  const [showPriceBreakdown, setShowPriceBreakdown] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!checkIn || !checkOut) return;
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/availability?check_in=${checkIn}&check_out=${checkOut}`);
      if (!res.ok) throw new Error('Failed to fetch availability.');
      const data: CategoryAvailability[] = await res.json();
      setAvailability(data);
      setStep('results');
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = (cat: CategoryAvailability) => {
    setSelected(cat);
    setStep('checkout');
  };

  const handleConfirm = async () => {
    if (!selected) return;
    if (!guest.name || !guest.email || !guest.phone) {
      setError('Please fill in all guest details.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guest.name,
          email: guest.email,
          phone: guest.phone,
          category: selected.category,
          check_in_date: checkIn,
          check_out_date: checkOut,
          total_price: selected.total_price,
          adults: guest.adults,
          kids: guest.kids,

          special_requests: guest.specialRequests,
        }),
      });
      if (!res.ok) throw new Error('Booking failed.');
      const data = await res.json();
      setConfirmedId(data.booking_id);
      setConfirmedRef(data.reference_number || '');
      setStep('confirmed');
    } catch {
      setError('Unable to complete booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const nights = nightCount(checkIn, checkOut);

  // ── Confirmed ──────────────────────────────────────────────────────────────
  if (step === 'confirmed') {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={36} />
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Booking Received!</h2>
          <p className="text-slate-500 mb-4">Booking reference: <span className="font-bold text-ocean">{confirmedRef || `#${confirmedId}`}</span></p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-slate-700 space-y-2 mb-6">
            <p><span className="font-semibold">Room:</span> {selected?.category}</p>
            <p><span className="font-semibold">Check-in:</span> {formatDate(checkIn)} from 2:00 PM</p>
            <p><span className="font-semibold">Check-out:</span> {formatDate(checkOut)} by 11:00 AM</p>
            <p><span className="font-semibold">Total:</span> ${selected?.total_price.toFixed(2)}</p>
          </div>
          <p className="text-slate-500 text-sm mb-8">We'll confirm your booking shortly. A deposit is required at check-in.</p>
          <Link to="/" className="btn-primary w-full flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-light/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="text-slate-500 hover:text-ocean transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Three Oaks Motel" className="h-10 w-auto" />
          <div className="ml-auto text-right hidden sm:block">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Check-in 2:00 PM · Check-out 11:00 AM</p>
            <p className="text-xs text-slate-400">(321) 267-6272</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">

        {/* ── Date Picker Bar ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-1">Find Your Room</h1>
          <p className="text-slate-500 text-sm mb-6">Select your dates to see availability and pricing.</p>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Check-in</label>
              <input
                type="date"
                min={today}
                value={checkIn}
                onChange={e => { setCheckIn(e.target.value); setStep('search'); }}
                className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/40 bg-white text-slate-800"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Check-out</label>
              <input
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={e => { setCheckOut(e.target.value); setStep('search'); }}
                className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/40 bg-white text-slate-800"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary px-8 py-3 whitespace-nowrap disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Search Rooms'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          {checkIn && checkOut && nights > 0 && (
            <p className="text-slate-500 text-sm mt-3 flex items-center gap-1.5">
              <Moon size={14} className="text-ocean" />
              {nights} {nights === 1 ? 'night' : 'nights'} · {formatDate(checkIn)} → {formatDate(checkOut)}
            </p>
          )}
        </div>

        {/* ── Room Results ────────────────────────────────────────────────── */}
        {step === 'results' && (
          <div className="space-y-6">
            <h2 className="text-lg font-display font-bold text-slate-800">Available Rooms</h2>
            {availability.map(cat => {
              const info = ROOM_INFO[cat.category];
              const hasVariablePricing = new Set(cat.nightly_prices.map(n => n.price)).size > 1;
              const minPrice = Math.min(...cat.nightly_prices.map(n => n.price));
              const isOpen = showPriceBreakdown === cat.category;

              return (
                <div key={cat.category} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${cat.available_count === 0 ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="md:w-64 h-48 md:h-auto relative flex-shrink-0 overflow-hidden">
                      <img
                        src={`${import.meta.env.BASE_URL}${info?.image}`}
                        alt={cat.category}
                        className="w-full h-full object-cover"
                      />
                      {cat.available_count === 0 && (
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                          <span className="text-white font-bold text-sm uppercase tracking-wider">Sold Out</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                          <h3 className="text-xl font-display font-bold text-slate-900">{cat.category}</h3>
                          {cat.available_count > 0 && (
                            <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                              {cat.available_count} room{cat.available_count !== 1 ? 's' : ''} available
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm mb-4">{info?.desc}</p>

                        {/* Amenity chips */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {['Private bathroom', 'Microwave', 'Refrigerator', 'Cable TV', 'Free WiFi', 'Linens'].map(a => (
                            <span key={a} className="text-[11px] uppercase tracking-wide font-bold px-2 py-1 bg-sky-light/70 text-ocean rounded">
                              {a}
                            </span>
                          ))}
                        </div>

                      </div>

                      <div className="flex items-end justify-between flex-wrap gap-4">
                        {/* Pricing */}
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-display font-bold text-slate-900">
                              ${hasVariablePricing ? minPrice.toFixed(0) : cat.nightly_prices[0]?.price.toFixed(0) ?? '—'}
                            </span>
                            <span className="text-slate-400 text-sm">{hasVariablePricing ? '/night from' : '/night'}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-slate-600 font-semibold text-sm">
                              Total: ${cat.total_price.toFixed(2)} · {nights} night{nights !== 1 ? 's' : ''}
                            </span>
                            {nights > 1 && (
                              <button
                                onClick={() => setShowPriceBreakdown(isOpen ? null : cat.category)}
                                className="text-xs text-ocean underline-offset-2 hover:underline"
                              >
                                {isOpen ? 'Hide breakdown' : 'View breakdown'}
                              </button>
                            )}
                          </div>

                          {/* Per-night breakdown */}
                          {isOpen && (
                            <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1 max-w-xs">
                              {cat.nightly_prices.map(n => (
                                <div key={n.date} className="flex justify-between">
                                  <span>{formatDate(n.date)}</span>
                                  <span className="font-semibold">${n.price.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                                <span>Total</span>
                                <span>${cat.total_price.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleReserve(cat)}
                          disabled={cat.available_count === 0}
                          className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Reserve <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Checkout ────────────────────────────────────────────────────── */}
        {step === 'checkout' && selected && (
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setStep('results')} className="flex items-center gap-2 text-slate-500 hover:text-ocean mb-6 text-sm font-medium transition-colors">
              <ArrowLeft size={16} /> Back to rooms
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Summary header */}
              <div className="bg-ocean text-white p-6">
                <h2 className="text-2xl font-display font-bold mb-1">{selected.category}</h2>
                <div className="flex flex-wrap gap-4 text-white/80 text-sm mt-3">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={14} />
                    {formatDate(checkIn)} → {formatDate(checkOut)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Moon size={14} />
                    {nights} night{nights !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CreditCard size={14} />
                    Total: ${selected.total_price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Guest info */}
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-display font-bold text-slate-900 mb-4">Guest Details</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={guest.name}
                    onChange={e => setGuest({ ...guest, name: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={guest.email}
                      onChange={e => setGuest({ ...guest, email: e.target.value })}
                      className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="(321) 555-0000"
                      value={guest.phone}
                      onChange={e => setGuest({ ...guest, phone: e.target.value })}
                      className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/40"
                    />
                  </div>
                </div>

                {/* Guests */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Adults</label>
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                      <button type="button" onClick={() => setGuest(g => ({ ...g, adults: Math.max(1, g.adults - 1) }))}
                        className="px-3 py-2.5 text-slate-500 hover:bg-slate-50 font-bold text-lg leading-none">−</button>
                      <span className="flex-1 text-center font-bold text-slate-800">{guest.adults}</span>
                      <button type="button" onClick={() => setGuest(g => ({ ...g, adults: Math.min(10, g.adults + 1) }))}
                        className="px-3 py-2.5 text-slate-500 hover:bg-slate-50 font-bold text-lg leading-none">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Children</label>
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                      <button type="button" onClick={() => setGuest(g => ({ ...g, kids: Math.max(0, g.kids - 1) }))}
                        className="px-3 py-2.5 text-slate-500 hover:bg-slate-50 font-bold text-lg leading-none">−</button>
                      <span className="flex-1 text-center font-bold text-slate-800">{guest.kids}</span>
                      <button type="button" onClick={() => setGuest(g => ({ ...g, kids: Math.min(10, g.kids + 1) }))}
                        className="px-3 py-2.5 text-slate-500 hover:bg-slate-50 font-bold text-lg leading-none">+</button>
                    </div>
                  </div>
                </div>

                {/* Special requests */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Special Requests <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                  <textarea
                    rows={3}
                    placeholder="e.g. ground floor room, extra pillows, late check-in…"
                    value={guest.specialRequests}
                    onChange={e => setGuest({ ...guest, specialRequests: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-ocean/40 resize-none text-sm"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 flex gap-3">
                  <CreditCard size={18} className="flex-shrink-0 mt-0.5" />
                  <span>A deposit is required at check-in. Your booking will be confirmed by our team shortly.</span>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="btn-primary w-full py-4 text-base mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Confirming…' : <><Check size={18} /> Confirm Booking</>}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
