import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Car, 
  Users, 
  ClipboardList, 
  ScrollText, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Дашборд", end: true },
  { path: "/admin/orders", icon: ClipboardList, label: "Заказы" },
  { path: "/admin/drivers", icon: Car, label: "Водители" },
  { path: "/admin/clients", icon: Users, label: "Клиенты" },
  { path: "/admin/logs", icon: ScrollText, label: "Логи" },
  { path: "/admin/settings", icon: Settings, label: "Настройки" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const adminData = localStorage.getItem("admin_data");
    
    if (!token || !adminData) {
      navigate("/admin/login");
      return;
    }
    
    setAdmin(JSON.parse(adminData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    navigate("/admin/login");
  };

  if (!admin) return null;

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden" data-testid="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-[#1c1c1e] border-r border-white/5
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2AABEE] flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold">Такси</h1>
              <p className="text-xs text-white/60">Админ-панель</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                ${isActive 
                  ? 'bg-[#2AABEE] text-white' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        {/* User & Logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#2c2c2e] flex items-center justify-center">
              <Users className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{admin.first_name || admin.username || 'Admin'}</p>
              <p className="text-xs text-white/60 truncate">ID: {admin.telegram_id}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Выйти
          </Button>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#1c1c1e]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="w-6 h-6" />
          </Button>
          <h1 className="font-bold">Такси</h1>
          <div className="w-10" />
        </header>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
