import { HashRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminDashboard from "./pages/AdminDashboard";
import GalleryPage from "./pages/GalleryPage";
import BookingPage from "./pages/BookingPage";
import RocketLaunch from "./components/RocketLaunch";

function App() {
  return (
    <Router>
      <RocketLaunch />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
