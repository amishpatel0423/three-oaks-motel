import { useState, useEffect } from 'react';
import { Home, Check, X, LayoutDashboard, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  room_preference: string;
  status: string;
  email: string;
  phone: string;
}

export default function AdminDashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch('http://localhost:8000/api/rooms'),
        fetch('http://localhost:8000/api/bookings')
      ]);
      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      
      setRooms(roomsData);
      setBookings(bookingsData.filter((b: Booking) => b.status === "Pending"));
    } catch (error) {
      console.error("Dashboard sync error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/bookings/${id}/approve`, { method: 'PATCH' });
      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        alert(error.detail || "Approval failed. Check room inventory.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm("Confirm rejection of this request?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/bookings/${id}/reject`, { method: 'PATCH' });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-700 border-green-200';
      case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Occupied': return 'bg-red-100 text-red-700 border-red-200';
      case 'Maintenance': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-500';
      case 'Pending': return 'bg-yellow-500';
      case 'Occupied': return 'bg-red-500';
      case 'Maintenance': return 'bg-slate-400';
      default: return 'bg-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-sky-light/30 font-body text-slate-800">
      {/* Admin Header */}
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
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Sync Data
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            <Home size={16} />
            View Site
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Status Board */}
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle size={20} className="text-ocean" />
                Room Status Board
              </h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {rooms.map(room => (
                <div 
                  key={room.id} 
                  className={`p-4 rounded-xl border transition-all duration-300 ${getStatusClasses(room.status)}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-3xl font-display font-black opacity-80">{room.room_number}</span>
                    <div className={`w-3 h-3 rounded-full ${getStatusDot(room.status)} shadow-sm`}></div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{room.room_type}</p>
                  <p className="text-xs font-bold">{room.status}</p>
                </div>
              ))}
            </div>
            {rooms.length === 0 && !loading && (
              <div className="text-center py-10 text-slate-400 text-sm italic">No data available.</div>
            )}
          </section>

          {/* Booking Queue */}
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={20} className="text-ocean" />
                Pending Booking Queue
              </h2>
              <span className="bg-ocean/10 text-ocean text-xs font-black py-1 px-3 rounded-full">
                {bookings.length} REQUESTS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Info</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Preference</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bookings.map(booking => (
                    <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{booking.guest_name}</div>
                        <div className="text-xs text-slate-500">{booking.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-ocean bg-ocean/5 py-1 px-2 rounded border border-ocean/10">
                          {booking.room_preference}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-medium text-slate-700">In: {booking.check_in_date}</div>
                        <div className="text-xs font-medium text-slate-700">Out: {booking.check_out_date}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleApprove(booking.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                            title="Approve Request"
                          >
                            <Check size={20} />
                          </button>
                          <button 
                            onClick={() => handleReject(booking.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Reject Request"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <Check size={48} />
                          <p className="text-sm font-medium">Queue is empty. Everything is set!</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
