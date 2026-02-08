import { useState, useEffect } from "react";
import axios from "axios";
import { 
  ClipboardList, 
  Car, 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          axios.get(`${API}/admin/stats`),
          axios.get(`${API}/admin/orders`, { params: { limit: 5 } })
        ]);
        
        setStats(statsRes.data);
        setRecentOrders(ordersRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      NEW: "bg-yellow-500/10 text-yellow-500",
      BROADCAST: "bg-blue-500/10 text-blue-500",
      ASSIGNED: "bg-green-500/10 text-green-500",
      COMPLETED: "bg-gray-500/10 text-gray-400",
      CANCELLED: "bg-red-500/10 text-red-500"
    };
    const labels = {
      NEW: "Новый",
      BROADCAST: "Ожидает",
      ASSIGNED: "Назначен",
      COMPLETED: "Завершён",
      CANCELLED: "Отменён"
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2AABEE]" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <div>
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <p className="text-white/60 mt-1">Обзор системы</p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-[#1c1c1e] border-white/5 hover:border-white/10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#2AABEE]/20 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-[#2AABEE]" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Всего заказов</p>
              <p className="text-2xl font-bold">{stats?.orders?.total || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-[#1c1c1e] border-white/5 hover:border-white/10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Активных</p>
              <p className="text-2xl font-bold">{stats?.orders?.active || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-[#1c1c1e] border-white/5 hover:border-white/10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Car className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Водителей</p>
              <p className="text-2xl font-bold">{stats?.drivers?.total || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-[#1c1c1e] border-white/5 hover:border-white/10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Клиентов</p>
              <p className="text-2xl font-bold">{stats?.clients?.total || 0}</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Orders Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-[#1c1c1e] border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-white/60">Завершено</span>
          </div>
          <p className="text-3xl font-bold">{stats?.orders?.completed || 0}</p>
        </Card>
        
        <Card className="p-6 bg-[#1c1c1e] border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-white/60">Отменено</span>
          </div>
          <p className="text-3xl font-bold">{stats?.orders?.cancelled || 0}</p>
        </Card>
        
        <Card className="p-6 bg-[#1c1c1e] border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-[#2AABEE]" />
            <span className="text-white/60">Водители заняты</span>
          </div>
          <p className="text-3xl font-bold">{stats?.drivers?.busy || 0}</p>
        </Card>
      </div>
      
      {/* Recent Orders */}
      <Card className="bg-[#1c1c1e] border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="font-semibold">Последние заказы</h2>
        </div>
        <div className="divide-y divide-white/5">
          {recentOrders.length === 0 ? (
            <div className="p-6 text-center text-white/40">
              Заказов пока нет
            </div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-white/60">
                        #{order.id.slice(0, 8)}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm truncate">
                      {order.address_from} → {order.address_to}
                    </p>
                  </div>
                  <p className="text-xs text-white/40 ml-4">
                    {new Date(order.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
