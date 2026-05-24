import { useState, useEffect } from 'react';
import { Home, Check, X, LayoutDashboard, Calendar, RefreshCw, AlertCircle, DollarSign, Trash2, Plus, BedDouble } from 'lucide-react';
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

interface AvailableRoom {
  id: number;
  room_number: string;
  room_type: string;
}

type Tab = 'dashboard' | 'occupancy' | 'pricing';

const CATEGORY_ROOM_TYPES: Record<string, string[]> = {
  'One King':     ['King', 'One Queen'],
  'Two Queen':    ['2 Queen'],
  '2 Double Bed': ['2 Full', 'One Full'],
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Room picker state (for manual assignment)
  const [pickingRoomFor, setPickingRoomFor] = useState<number | null>(null); // booking id
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [roomPickerLoading, setRoomPickerLoading] = useState(false);

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
      const fetched: Booking[] = await bookingsRes.json();
      setAllBookings(fetched);
      setBookings(fetched.filter(b => b.status === 'Pending'));
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

  const openRoomPicker = async (booking: Booking) => {
    setPickingRoomFor(booking.id);
    setSelectedRoom('');
    setRoomPickerLoading(true);
    try {
      const res = await fetch(`${API}/api/bookings/${booking.id}/available-rooms`);
      const data: AvailableRoom[] = await res.json();
      setAvailableRooms(data);
      if (data.length > 0) setSelectedRoom(data[0].room_number);
    } catch (e) { console.error(e); }
    finally { setRoomPickerLoading(false); }
  };

  const handleApprove = async (id: number) => {
    try {
      const body = selectedRoom ? JSON.stringify({ room_number: selectedRoom }) : '{}';
      const res = await fetch(`${API}/api/bookings/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        setPickingRoomFor(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Approval failed.');
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
      <header className="bg-white border-b border-slate-200 py-3 px-4 md:py-4 md:px-8 sticky top-0 z-50 flex justify-between items-center flex-wrap gap-y-2 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-ocean rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-900">Property Manager</h1>
            <p className="hidden sm:block text-xs text-slate-500 font-medium uppercase tracking-wider">Three Oaks Motel Dashboard</p>
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
      <div className="bg-white border-b border-slate-200 px-4 md:px-8">
        <div className="flex gap-1 max-w-7xl mx-auto overflow-x-auto">
          <button
            onClick={() => setTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'dashboard' ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Calendar size={16} /> Bookings
          </button>
          <button
            onClick={() => setTab('occupancy')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'occupancy' ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <BedDouble size={16} /> Occupancy
          </button>
          <button
            onClick={() => setTab('pricing')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'pricing' ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <DollarSign size={16} /> Pricing
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">

        {/* ── Dashboard Tab ──────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">

            {/* Room Status Board */}
            <section className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertCircle size={20} className="text-ocean" />
                <h2 className="text-lg font-display font-bold text-slate-900">Room Status</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                <table className="w-full text-left min-w-[580px]">
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
                      <>
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
                              onClick={() => pickingRoomFor === b.id ? setPickingRoomFor(null) : openRoomPicker(b)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${pickingRoomFor === b.id ? 'bg-ocean text-white border-ocean' : 'text-green-600 hover:bg-green-50 border-transparent hover:border-green-100'}`}
                              title="Assign Room & Approve"
                            >
                              <BedDouble size={15} />
                              Assign
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

                      {/* Room picker row */}
                      {pickingRoomFor === b.id && (
                        <tr key={`picker-${b.id}`} className="bg-ocean/5 border-b border-ocean/10">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <BedDouble size={16} className="text-ocean flex-shrink-0" />
                              <span className="text-sm font-semibold text-slate-700">Assign room for {b.guest_name}:</span>
                              {roomPickerLoading ? (
                                <span className="text-sm text-slate-400 italic">Loading rooms…</span>
                              ) : availableRooms.length === 0 ? (
                                <span className="text-sm text-red-500 font-medium">No available rooms for these dates.</span>
                              ) : (
                                <>
                                  <select
                                    value={selectedRoom}
                                    onChange={e => setSelectedRoom(e.target.value)}
                                    className="p-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-ocean/40"
                                  >
                                    {availableRooms.map(r => (
                                      <option key={r.id} value={r.room_number}>
                                        Room {r.room_number} — {r.room_type}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleApprove(b.id)}
                                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                                  >
                                    <Check size={15} /> Confirm
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setPickingRoomFor(null)}
                                className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
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

        {/* ── Occupancy Tab ──────────────────────────────────────────────── */}
        {tab === 'occupancy' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900">Room Occupancy</h2>
              <p className="text-sm text-slate-500 mt-1">Click a category to see who is assigned.</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CATEGORIES.map(cat => {
                const totalRooms = rooms.filter(r => CATEGORY_ROOM_TYPES[cat]?.includes(r.room_type)).length;
                const assignedBookings = allBookings.filter(b => b.status === 'Approved' && b.category === cat);
                const assignedCount = assignedBookings.length;
                const pct = totalRooms > 0 ? (assignedCount / totalRooms) * 100 : 0;
                const isExpanded = expandedCategory === cat;
                const barColor = pct >= 80 ? 'bg-amber-400' : pct >= 50 ? 'bg-ocean' : 'bg-green-500';
                const cardBorder = isExpanded ? 'border-ocean shadow-md' : 'border-slate-200 hover:border-ocean/40';

                return (
                  <button
                    key={cat}
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    className={`text-left bg-white rounded-2xl border-2 p-6 transition-all duration-200 ${cardBorder}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Room Category</p>
                        <h3 className="text-lg font-display font-bold text-slate-900">{cat}</h3>
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpanded ? 'bg-ocean text-white' : 'bg-ocean/10 text-ocean'}`}>
                        <BedDouble size={20} />
                      </div>
                    </div>

                    <div className="flex items-end gap-1 mb-3">
                      <span className="text-3xl font-display font-black text-slate-900">{assignedCount}</span>
                      <span className="text-sm text-slate-400 font-medium mb-1">/ {totalRooms} assigned</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{totalRooms - assignedCount} rooms free</p>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            {expandedCategory && (() => {
              const assigned = allBookings
                .filter(b => b.status === 'Approved' && b.category === expandedCategory)
                .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));

              return (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                    <BedDouble size={18} className="text-ocean" />
                    <h3 className="font-display font-bold text-slate-900">{expandedCategory} — Assigned Bookings</h3>
                    <span className="ml-auto text-xs font-bold text-ocean bg-ocean/10 px-2.5 py-1 rounded-full">{assigned.length} booking{assigned.length !== 1 ? 's' : ''}</span>
                  </div>

                  {assigned.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 text-sm italic">No rooms currently assigned in this category.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Room #</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Check-in</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Check-out</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {assigned.map(b => (
                            <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <span className="text-lg font-display font-black text-ocean">{b.assigned_room_number ?? '—'}</span>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-slate-900">{b.guest_name}</div>
                                <div className="text-xs text-slate-400">{b.phone}</div>
                              </td>
                              <td className="p-4 text-sm text-slate-600">{b.email}</td>
                              <td className="p-4 text-sm font-medium text-slate-700">{b.check_in_date}</td>
                              <td className="p-4 text-sm font-medium text-slate-700">{b.check_out_date}</td>
                              <td className="p-4 text-sm font-bold text-slate-800">
                                {b.total_price != null ? `$${b.total_price.toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
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
