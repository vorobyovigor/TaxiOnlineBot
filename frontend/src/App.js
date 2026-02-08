import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import MiniApp from "@/pages/MiniApp";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminClients from "@/pages/admin/AdminClients";
import AdminLogs from "@/pages/admin/AdminLogs";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminLogin from "@/pages/admin/AdminLogin";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" />
      <BrowserRouter>
        <Routes>
          {/* Mini App for clients */}
          <Route path="/" element={<MiniApp />} />
          
          {/* Admin Panel */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="drivers" element={<AdminDrivers />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
