import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Search, 
  Filter, 
  Eye,
  UserPlus,
  XCircle,
  CheckCircle,
  Loader2,
  MapPin,
  Navigation,
  User,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "NEW", label: "Новые" },
  { value: "BROADCAST", label: "Ожидают водителя" },
  { value: "ASSIGNED", label: "Назначены" },
  { value: "COMPLETED", label: "Завершены" },
  { value: "CANCELLED", label: "Отменены" },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialogs
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");

  const fetchOrders = async () => {
    try {
      const params = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      
      const res = await axios.get(`${API}/admin/orders`, { params });
      setOrders(res.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API}/admin/drivers`);
      setDrivers(res.data.filter(d => d.status === "ACTIVE" && !d.is_busy));
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchDrivers()]);
      setLoading(false);
    };
    loadData();
    
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleAssignDriver = async () => {
    if (!selectedOrder || !selectedDriver) return;
    
    try {
      await axios.post(`${API}/admin/orders/${selectedOrder.id}/assign`, {
        driver_id: selectedDriver
      });
      
      toast.success("Водитель назначен");
      setShowAssignDialog(false);
      setSelectedDriver("");
      fetchOrders();
      fetchDrivers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка назначения");
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      await axios.post(`${API}/admin/orders/${selectedOrder.id}/cancel`);
      
      toast.success("Заказ отменён");
      setShowCancelDialog(false);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка отмены");
    }
  };

  const handleCompleteOrder = async (order) => {
    try {
      await axios.post(`${API}/admin/orders/${order.id}/complete`);
      toast.success("Заказ завершён");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    }
  };

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
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.id.toLowerCase().includes(query) ||
      order.address_from.toLowerCase().includes(query) ||
      order.address_to.toLowerCase().includes(query) ||
      order.driver_name?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2AABEE]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-orders">
      <div>
        <h1 className="text-2xl font-bold">Заказы</h1>
        <p className="text-white/60 mt-1">Управление заказами</p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            placeholder="Поиск по ID, адресу, водителю..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1c1c1e] border-white/10"
            data-testid="search-orders-input"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-[#1c1c1e] border-white/10" data-testid="status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1c1c1e] border-white/10">
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Orders List */}
      <Card className="bg-[#1c1c1e] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-white/60 font-medium">ID</th>
                <th className="text-left p-4 text-white/60 font-medium">Маршрут</th>
                <th className="text-left p-4 text-white/60 font-medium">Статус</th>
                <th className="text-left p-4 text-white/60 font-medium">Водитель</th>
                <th className="text-left p-4 text-white/60 font-medium">Дата</th>
                <th className="text-right p-4 text-white/60 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-white/40">
                    Заказов не найдено
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <span className="font-mono text-sm">#{order.id.slice(0, 8)}</span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-green-500" />
                          <span className="text-sm truncate max-w-[200px]">{order.address_from}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Navigation className="w-3 h-3 text-red-500" />
                          <span className="text-sm truncate max-w-[200px]">{order.address_to}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(order.status)}</td>
                    <td className="p-4">
                      {order.driver_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                            <User className="w-4 h-4 text-white/60" />
                          </div>
                          <span className="text-sm">{order.driver_name}</span>
                        </div>
                      ) : (
                        <span className="text-white/40 text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-white/60">
                      {new Date(order.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDetailsDialog(true);
                          }}
                          data-testid={`view-order-${order.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {["NEW", "BROADCAST"].includes(order.status) && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#2AABEE] hover:text-[#2AABEE]"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowAssignDialog(true);
                              }}
                              data-testid={`assign-order-${order.id}`}
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowCancelDialog(true);
                              }}
                              data-testid={`cancel-order-${order.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        
                        {order.status === "ASSIGNED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-500 hover:text-green-400"
                            onClick={() => handleCompleteOrder(order)}
                            data-testid={`complete-order-${order.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Order Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-[#1c1c1e] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Детали заказа</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-white/60">#{selectedOrder.id.slice(0, 8)}</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-white/60 text-xs">Откуда</p>
                    <p>{selectedOrder.address_from}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Navigation className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-white/60 text-xs">Куда</p>
                    <p>{selectedOrder.address_to}</p>
                  </div>
                </div>
                {selectedOrder.comment && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-white/60 text-xs mb-1">Комментарий</p>
                    <p className="text-sm">{selectedOrder.comment}</p>
                  </div>
                )}
              </div>
              
              {selectedOrder.driver_name && (
                <div className="p-3 rounded-lg bg-[#2c2c2e]">
                  <p className="text-white/60 text-xs mb-2">Водитель</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2AABEE]/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-[#2AABEE]" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedOrder.driver_name}</p>
                      {selectedOrder.driver_phone && (
                        <p className="text-sm text-white/60 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedOrder.driver_phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/60">Создан</p>
                  <p>{new Date(selectedOrder.created_at).toLocaleString('ru-RU')}</p>
                </div>
                {selectedOrder.assigned_at && (
                  <div>
                    <p className="text-white/60">Назначен</p>
                    <p>{new Date(selectedOrder.assigned_at).toLocaleString('ru-RU')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Assign Driver Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="bg-[#1c1c1e] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Назначить водителя</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="bg-[#2c2c2e] border-white/10" data-testid="select-driver">
                <SelectValue placeholder="Выберите водителя" />
              </SelectTrigger>
              <SelectContent className="bg-[#1c1c1e] border-white/10">
                {drivers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Нет доступных водителей
                  </SelectItem>
                ) : (
                  drivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.first_name || driver.username || driver.telegram_id}
                      {driver.phone && ` (${driver.phone})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAssignDialog(false)}
              >
                Отмена
              </Button>
              <Button
                className="flex-1 bg-[#2AABEE] hover:bg-[#229ED9]"
                disabled={!selectedDriver}
                onClick={handleAssignDriver}
                data-testid="confirm-assign-btn"
              >
                Назначить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cancel Order Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-[#1c1c1e] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Вы уверены, что хотите отменить заказ #{selectedOrder?.id.slice(0, 8)}?
              Клиент получит уведомление.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#2c2c2e] border-transparent">
              Нет
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-red-500 hover:bg-red-600"
              data-testid="confirm-cancel-order-btn"
            >
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
