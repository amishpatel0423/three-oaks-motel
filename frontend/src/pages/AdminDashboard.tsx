import { useState, useEffect } from 'react';
import { Home, Check, X, LayoutDashboard, Calendar, RefreshCw, AlertCircle, DollarSign, Trash2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:8000';

interface Room {
  id: number;
  room_number: string;
  room_type: string;
  status: string;
}

interface Booking {
  id: number;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  category: string;
  status: string;
  email: string;
  phone: string;
  assigned_room_number: string | null;
  total_price: number | null;
}

interface CategoryRate {
  id: number;
  category: string;
  default_nightly_rate: number;
}

interface PriceOverride {
  id: number;
  category: string;
  date: string;
  price: number;
}

type Tab = 'dashboard' | 'pricing';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Pricing state
  const [, setRates] = useState<CategoryRate[]>([]);
  const [editRates, setEditRates] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [newOverride, setNewOverride] = useState({ category: 'One King', date: '', price: '' });
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingMsg, setPricingMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch(`${API}/api/rooms`),
        fetch(`${API}/api/bookings`),
      ]);
      setRooms(await roomsRes.json());
      const allBookings: Booking[] = await bookingsRes.json();
      setBookings(allBookings.filter(b => b.status === 'Pending'));
    } catch (error) {
      console.error('Dashboard sync error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async () => {
    setPricingLoading(true);
    try {
      const [ratesRes, overridesRes] = await Promise.all([
        fetch(`${API}/api/admin/pricing`),
        fetch(`${API}/api/admin/pricing/overrides`),
      ]);
      const ratesData: CategoryRate[] = await ratesRes.json();
      setRates(ratesData);
      setEditRates(Object.fromEntries(ratesData.map(r => [r.category, String(r.default_nightly_rate)])));
      setOverrides(await overridesRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setPricingLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPricing();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`${API}/api/bookings/${id}/approve`, { method: 'PATCH' });
      if (res.ok) fetchData();
      else {
        const err = await res.json();
        alert(err.detail || 'Approval failed.');
      }
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm('Confirm rejection?')) return;
    try {
      const res = await fetch(`${API}/api/bookings/${id}/reject`, { method: 'PATCH' });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  };

  const handleSaveRate = async (category: string) => {
    const rate = parseFloat(editRates[category]);
    if (isNaN(rate) || rate < 0) return;
    try {
      const res = await fetch(`${API}/api/admin/pricing/${encodeURIComponent(category)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_nightly_rate: rate }),
      });
      if (res.ok) {
        setPricingMsg(`Saved rate for ${category}.`);
        setTimeout(() => setPricingMsg(''), 3000);
        fetchPricing();
      }
    } catch (e) { console.error(e); }
  };

  const handleAddOverride = async () => {
    if (!newOverride.date || !newOverride.price) return;
    const price = parseFloat(newOverride.price);
    if (isNaN(price) || price < 0) return;
    try {
      const res = await fetch(`${API}/api/admin/pricing/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newOverride.category, date: newOverride.date, price }),
      });
      if (res.ok) {
        setNewOverride({ category: 'One King', date: '', price: '' });
        fetchPricing();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteOverride = async (id: number) => {
    try {
      const res = await fetch(`${API}/api/admin/pricing/overrides/${id}`, { method: 'DELETE' });
      if (res.ok) fetchPricing();
    } catch (e) { console.error(e); }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'Available':    return 'bg-green-100 text-green-700 border-green-200';
      case 'Occupied':     return 'bg-red-100 text-red-700 border-red-200';
      case 'Maintenance':  return 'bg-slate-100 text-slate-500 border-slate-200';
      default:             return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Available':    return 'bg-green-500';
      case 'Occupied':     return 'bg-red-500';
      case 'Maintenance':  return 'bg-slate-400';
      default:             return 'bg-slate-300';
    }
  };

  const CATEGORIES = ['One King', 'Two Queen', '2 Double Bed'];

  return (
    <div className="min-h-screen bg-sky-light/30 font-body text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-8 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-ocean rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-900">Property Manager</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Three Oaks Motel Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => { fetchData(); fetchPricing(); }}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Sync
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            <Home size={16} /> View Site
          </Link>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-8">
        <div className="flex gap-1 max-w-7xl mx-auto">
          <button
            onClick={() => setTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'dashboard' ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Calendar size={16} /> Bookings
          </button>
          <button
            onClick={() => setTab('pricing')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'pricing' ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <DollarSign size={16} /> Pricing
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-8">

        {/* ── Dashboard Tab ──────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Room Status Board */}
            <section className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertCircle size={20} className="text-ocean" />
                <h2 className="text-lg font-display font-bold text-slate-900">Room Status</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rooms.map(room => (
                  <div key={room.id} className={`p-3 rounded-xl border transition-all duration-300 ${getStatusClasses(room.status)}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xl font-display font-black opacity-80">{room.room_number}</span>
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 ${getStatusDot(room.status)}`} />
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-60 leading-tight">{room.room_type}</p>
                    <p className="text-[10px] font-bold mt-0.5">{room.status}</p>
                  </div>
                ))}
              </div>
              {rooms.length === 0 && !loading && (
                <div className="text-center py-10 text-slate-400 text-sm italic">No room data.</div>
              )}
            </section>

            {/* Booking Queue */}
            <section className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={20} className="text-ocean" /> Pending Bookings
                </h2>
                <span className="bg-ocean/10 text-ocean text-xs font-black py-1 px-3 rounded-full">
                  {bookings.length} REQUESTS
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Room</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bookings.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{b.guest_name}</div>
                          <div className="text-xs text-slate-500">{b.email}</div>
                          <div className="text-xs text-slate-400">{b.phone}</div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-ocean bg-ocean/5 py-1 px-2 rounded border border-ocean/10">
                            {b.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-medium text-slate-700">In: {b.check_in_date}</div>
                          <div className="text-xs font-medium text-slate-700">Out: {b.check_out_date}</div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-bold text-slate-800">
                            {b.total_price != null ? `$${b.total_price.toFixed(2)}` : '—'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(b.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                              title="Approve"
                            >
                              <Check size={20} />
                            </button>
                            <button
                              onClick={() => handleReject(b.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                              title="Reject"
                            >
                              <X size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <Check size={48} />
                            <p className="text-sm font-medium">Queue is clear. All good!</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ── Pricing Tab ────────────────────────────────────────────────── */}
        {tab === 'pricing' && (
          <div className="space-y-8 max-w-3xl">

            {pricingMsg && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <Check size={16} /> {pricingMsg}
              </div>
            )}

            {/* Default Rates */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-display font-bold text-slate-900 mb-1">Default Nightly Rates</h2>
              <p className="text-sm text-slate-500 mb-6">Set the base price per night for each room category. Use date overrides below for special pricing.</p>

              {pricingLoading ? (
                <p className="text-slate-400 text-sm italic">Loading…</p>
              ) : (
                <div className="space-y-4">
                  {CATEGORIES.map(cat => (
                    <div key={cat} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{cat}</p>
                        <p className="text-xs text-slate-400">per night</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editRates[cat] ?? ''}
                          onChange={e => setEditRates({ ...editRates, [cat]: e.target.value })}
                          className="w-24 p-2 rounded-lg border border-slate-200 text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-ocean/40"
                        />
                        <button
                          onClick={() => handleSaveRate(cat)}
                          className="btn-primary py-2 px-4 text-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Date Overrides */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-display font-bold text-slate-900 mb-1">Date-Specific Overrides</h2>
              <p className="text-sm text-slate-500 mb-6">Override the nightly rate for a specific category on a specific date (e.g. launch weekends, holidays).</p>

              {/* Add override row */}
              <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    value={newOverride.category}
                    onChange={e => setNewOverride({ ...newOverride, category: e.target.value })}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                  <input
                    type="date"
                    value={newOverride.date}
                    onChange={e => setNewOverride({ ...newOverride, date: e.target.value })}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="149"
                    value={newOverride.price}
                    onChange={e => setNewOverride({ ...newOverride, price: e.target.value })}
                    className="w-24 p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                  />
                </div>
                <button
                  onClick={handleAddOverride}
                  className="btn-primary py-2.5 px-4 text-sm flex items-center gap-1.5"
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              {/* Override list */}
              {overrides.length === 0 ? (
                <p className="text-slate-400 text-sm italic text-center py-6">No date overrides set.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {overrides.map(o => (
                    <div key={o.id} className="flex items-center justify-between py-3 px-1">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-ocean bg-ocean/5 px-2 py-0.5 rounded border border-ocean/10">{o.category}</span>
                        <span className="text-sm text-slate-700 font-medium">{o.date}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-slate-800">${o.price.toFixed(2)}</span>
                        <button
                          onClick={() => handleDeleteOverride(o.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete override"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

      </main>
    </div>
  );
}
