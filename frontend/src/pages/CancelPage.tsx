import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, CheckCircle, AlertTriangle, ArrowLeft, Phone } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://three-oaks-motel-api.onrender.com';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

interface BookingInfo {
  reference_number: string;
  guest_name: string;
  category: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number | null;
  status: string;
  can_cancel: boolean;
}

export default function CancelPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading]     = useState(true);
  const [booking, setBooking]     = useState<BookingInfo | null>(null);
  const [error, setError]         = useState('');
  const [confirming, setConfirming] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No cancellation token provided.');
      setLoading(false);
      return;
    }
    fetch(`${API}/api/bookings/cancel/${token}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Invalid link.'); }
        else { setBooking(data); }
      })
      .catch(() => setError('Unable to load booking. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this reservation? This cannot be undone.')) return;
    setConfirming(true);
    try {
      const res = await fetch(`${API}/api/bookings/cancel/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Cancellation failed.'); }
      else { setCancelled(true); }
    } catch {
      setError('Unable to process cancellation. Please call us at (321) 267-6272.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Loading reservation…</div>
      </div>
    );
  }

  // ── Cancelled successfully ─────────────────────────────────────────────────
  if (cancelled) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">Reservation Cancelled</h2>
          <p className="text-slate-500 mb-2">Your reservation has been successfully cancelled.</p>
          <p className="text-slate-500 text-sm mb-8">A confirmation email has been sent to you.</p>
          <Link to="/" className="btn-primary w-full flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !booking) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={36} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">Unable to Cancel</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <a href="tel:3212676272" className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
            <Phone size={16} /> Call (321) 267-6272
          </a>
          <Link to="/" className="block text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Within 24-hour window — cannot cancel ─────────────────────────────────
  if (!booking.can_cancel) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={36} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">Cancellation Window Passed</h2>
          <p className="text-slate-500 mb-2">
            Reservations can only be cancelled more than 24 hours before check-in.
          </p>
          <p className="text-slate-500 text-sm mb-2">
            <span className="font-semibold">Check-in:</span> {formatDate(booking.check_in_date)}
          </p>
          <p className="text-slate-500 text-sm mb-8">Please call us directly to discuss your options.</p>
          <a href="tel:3212676272" className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
            <Phone size={16} /> Call (321) 267-6272
          </a>
          <Link to="/" className="block text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Valid — show booking + confirm button ─────────────────────────────────
  return (
    <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle size={30} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Cancel Reservation</h2>
          <p className="text-slate-500 text-sm">Review your booking details before cancelling.</p>
        </div>

        {/* Booking summary */}
        <div className="bg-slate-50 rounded-xl p-5 mb-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Reference</span>
            <span className="font-mono font-bold text-ocean">{booking.reference_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Guest</span>
            <span className="font-semibold text-slate-800">{booking.guest_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Room</span>
            <span className="font-semibold text-slate-800">{booking.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Check-in</span>
            <span className="text-slate-800">{formatDate(booking.check_in_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Check-out</span>
            <span className="text-slate-800">{formatDate(booking.check_out_date)}</span>
          </div>
          {booking.total_price != null && (
            <div className="flex justify-between border-t border-slate-200 pt-3 mt-3">
              <span className="text-slate-500 font-medium">Total</span>
              <span className="font-bold text-slate-900">${booking.total_price.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Note:</strong> Cancellations within 24 hours of check-in are not available online. This action cannot be undone.
        </div>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <button
          onClick={handleCancel}
          disabled={confirming}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mb-3"
        >
          {confirming ? 'Cancelling…' : 'Yes, Cancel My Reservation'}
        </button>
        <Link to="/" className="block text-center text-sm text-slate-400 hover:text-slate-600 transition-colors">
          Keep my reservation
        </Link>
      </div>
    </div>
  );
}
