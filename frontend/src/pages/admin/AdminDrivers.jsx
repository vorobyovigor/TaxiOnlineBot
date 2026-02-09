import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Search, 
  UserCheck,
  UserX,
  Phone,
  Loader2,
  Car,
  Edit2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit dialog
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "",
    car_brand: "",
    car_model: "",
    car_color: "",
    car_plate: ""
  });

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API}/admin/drivers`);
      setDrivers(res.data);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleToggleStatus = async (driver) => {
    const newStatus = driver.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    
    try {
      await axios.patch(`${API}/admin/drivers/${driver.id}`, {
        status: newStatus
      });
      
      toast.success(newStatus === "ACTIVE" ? "Водитель разблокирован" : "Водитель заблокирован");
      fetchDrivers();
    } catch (error) {
      toast.error("Ошибка изменения статуса");
    }
  };

  const handleUpdateDriver = async () => {
    if (!selectedDriver) return;
    
    try {
      const updateData = {
        phone: editForm.phone.trim() || null,
        car_brand: editForm.car_brand.trim() || null,
        car_model: editForm.car_model.trim() || null,
        car_color: editForm.car_color.trim() || null,
        car_plate: editForm.car_plate.trim().toUpperCase() || null
      };
      
      await axios.patch(`${API}/admin/drivers/${selectedDriver.id}`, updateData);
      
      toast.success("Профиль водителя обновлён");
      setShowEditDialog(false);
      fetchDrivers();
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const getStatusBadge = (status) => {
    if (status === "ACTIVE") {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
          Активен
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
        Заблокирован
      </span>
    );
  };

  const filteredDrivers = drivers.filter(driver => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      driver.telegram_id.toLowerCase().includes(query) ||
      driver.first_name?.toLowerCase().includes(query) ||
      driver.last_name?.toLowerCase().includes(query) ||
      driver.username?.toLowerCase().includes(query) ||
      driver.phone?.toLowerCase().includes(query)
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
    <div className="space-y-6" data-testid="admin-drivers">
      <div>
        <h1 className="text-2xl font-bold">Водители</h1>
        <p className="text-white/60 mt-1">Управление водителями</p>
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <Input
          placeholder="Поиск водителя..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#1c1c1e] border-white/10"
          data-testid="search-drivers-input"
        />
      </div>
      
      {/* Drivers Grid */}
      {filteredDrivers.length === 0 ? (
        <Card className="bg-[#1c1c1e] border-white/5 p-8 text-center">
          <Car className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">Водителей не найдено</p>
          <p className="text-white/40 text-sm mt-1">
            Водители регистрируются автоматически при принятии первого заказа
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map(driver => (
            <Card 
              key={driver.id} 
              className="bg-[#1c1c1e] border-white/5 p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    driver.status === "ACTIVE" ? "bg-[#2AABEE]/20" : "bg-red-500/20"
                  }`}>
                    <Car className={`w-6 h-6 ${
                      driver.status === "ACTIVE" ? "text-[#2AABEE]" : "text-red-500"
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium">
                      {driver.first_name || driver.username || 'Водитель'}
                      {driver.last_name && ` ${driver.last_name}`}
                    </p>
                    <p className="text-white/60 text-sm">@{driver.username || driver.telegram_id}</p>
                  </div>
                </div>
                {getStatusBadge(driver.status)}
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-white/40" />
                  <span className={driver.phone ? "text-white" : "text-white/40"}>
                    {driver.phone || "Не указан"}
                  </span>
                </div>
                {driver.is_registered && driver.car_brand && (
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="w-4 h-4 text-white/40" />
                    <span className="text-white">
                      {driver.car_brand} {driver.car_model} {driver.car_color}
                    </span>
                  </div>
                )}
                {driver.is_registered && driver.car_plate && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-4 h-4 text-white/40 text-center">🔢</span>
                    <span className="text-white font-mono">{driver.car_plate}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  {driver.is_registered ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Зарегистрирован</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-500">Не завершил регистрацию</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${
                    driver.is_busy ? "bg-yellow-500" : "bg-green-500"
                  }`} />
                  <span className="text-white/60">
                    {driver.is_busy ? "Занят заказом" : "Свободен"}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedDriver(driver);
                    setEditForm({
                      phone: driver.phone || "",
                      car_brand: driver.car_brand || "",
                      car_model: driver.car_model || "",
                      car_color: driver.car_color || "",
                      car_plate: driver.car_plate || ""
                    });
                    setShowEditDialog(true);
                  }}
                  data-testid={`edit-driver-${driver.id}`}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Редактировать
                </Button>
                <Button
                  variant={driver.status === "ACTIVE" ? "destructive" : "default"}
                  size="sm"
                  onClick={() => handleToggleStatus(driver)}
                  data-testid={`toggle-driver-${driver.id}`}
                >
                  {driver.status === "ACTIVE" ? (
                    <UserX className="w-4 h-4" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {/* Edit Phone Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[#1c1c1e] border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle>Редактирование телефона</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-2 block">Номер телефона</label>
              <Input
                placeholder="+7 999 123 45 67"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="bg-[#2c2c2e] border-white/10"
                data-testid="edit-phone-input"
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEditDialog(false)}
              >
                Отмена
              </Button>
              <Button
                className="flex-1 bg-[#2AABEE] hover:bg-[#229ED9]"
                onClick={handleUpdatePhone}
                data-testid="save-phone-btn"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
