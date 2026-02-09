import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { MapPin, Navigation, MessageSquare, X, Clock, User, Phone, Loader2, CheckCircle, AlertCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// Get Telegram WebApp object
const tg = window.Telegram?.WebApp;

export default function MiniApp() {
  const [user, setUser] = useState(null);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [requestingPhone, setRequestingPhone] = useState(false);
  
  // Form state
  const [addressFrom, setAddressFrom] = useState("");
  const [addressTo, setAddressTo] = useState("");
  const [comment, setComment] = useState("");

  // Initialize Telegram WebApp
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
    }
  }, []);

  // Auth and fetch active order
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      
      let telegramId = null;
      let userData = null;
      
      if (tg?.initDataUnsafe?.user?.id) {
        telegramId = String(tg.initDataUnsafe.user.id);
        
        // Auth with backend
        try {
          const authRes = await axios.post(`${API}/client/auth`, {
            init_data: tg.initData || ""
          });
          userData = authRes.data;
          
          // Check if phone is required
          if (!userData.phone) {
            setNeedsPhone(true);
            setUser(userData);
            setLoading(false);
            return;
          }
        } catch (authError) {
          console.error("Auth error:", authError);
          // Use data from Telegram directly - but require phone
          userData = {
            telegram_id: telegramId,
            first_name: tg.initDataUnsafe.user.first_name,
            last_name: tg.initDataUnsafe.user.last_name,
            username: tg.initDataUnsafe.user.username
          };
          setNeedsPhone(true);
          setUser(userData);
          setLoading(false);
          return;
        }
      } else {
        // Demo mode for testing outside Telegram
        telegramId = "demo_user_123";
        userData = { telegram_id: telegramId, first_name: "Demo User", phone: "+7 999 123 4567" };
      }
      
      setUser(userData);
      setNeedsPhone(false);
      
      // Fetch active order
      try {
        const orderRes = await axios.get(`${API}/client/order/active`, {
          params: { telegram_id: telegramId }
        });
        setActiveOrder(orderRes.data);
      } catch (orderError) {
        console.error("Order fetch error:", orderError);
      }
      
    } catch (error) {
      console.error("Init error:", error);
      // Demo mode fallback
      setUser({ telegram_id: "demo_user_123", first_name: "Demo User", phone: "+7 999 123 4567" });
    } finally {
      setLoading(false);
    }
  }, []);

  // Request phone number from Telegram
  const requestPhone = useCallback(async () => {
    setRequestingPhone(true);
    
    try {
      if (tg?.requestContact) {
        // Use Telegram's requestContact method
        tg.requestContact((success, event) => {
          if (success && event?.responseUnsafe?.contact?.phone_number) {
            const phone = event.responseUnsafe.contact.phone_number;
            savePhone(phone);
          } else {
            toast.error("Не удалось получить номер телефона");
            setRequestingPhone(false);
          }
        });
      } else {
        toast.error("Функция недоступна вне Telegram");
        setRequestingPhone(false);
      }
    } catch (error) {
      console.error("Request phone error:", error);
      toast.error("Ошибка при запросе номера телефона");
      setRequestingPhone(false);
    }
  }, []);

  // Save phone to backend
  const savePhone = async (phone) => {
    try {
      const telegramId = user?.telegram_id || String(tg?.initDataUnsafe?.user?.id);
      
      const res = await axios.post(`${API}/client/update-phone`, {
        telegram_id: telegramId,
        phone: phone
      });
      
      setUser(res.data);
      setNeedsPhone(false);
      toast.success("Номер телефона сохранён!");
      
      // Fetch active order
      try {
        const orderRes = await axios.get(`${API}/client/order/active`, {
          params: { telegram_id: telegramId }
        });
        setActiveOrder(orderRes.data);
      } catch (e) {}
      
    } catch (error) {
      console.error("Save phone error:", error);
      toast.error("Ошибка сохранения номера");
    } finally {
      setRequestingPhone(false);
    }
  };

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Poll for order updates
  useEffect(() => {
    if (!user?.telegram_id || !activeOrder) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/client/order/active`, {
          params: { telegram_id: user.telegram_id }
        });
        setActiveOrder(res.data);
      } catch (error) {
        console.error("Poll error:", error);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [user?.telegram_id, activeOrder]);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    
    if (!addressFrom.trim() || !addressTo.trim()) {
      toast.error("Заполните адреса отправления и назначения");
      return;
    }
    
    try {
      setSubmitting(true);
      
      const res = await axios.post(`${API}/client/order`, {
        address_from: addressFrom.trim(),
        address_to: addressTo.trim(),
        comment: comment.trim() || null
      }, {
        params: { telegram_id: user.telegram_id }
      });
      
      setActiveOrder(res.data);
      setAddressFrom("");
      setAddressTo("");
      setComment("");
      toast.success("Заказ создан! Ищем водителя...");
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка при создании заказа");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    
    try {
      await axios.post(`${API}/client/order/${activeOrder.id}/cancel`, null, {
        params: { telegram_id: user.telegram_id }
      });
      
      setActiveOrder(null);
      setShowCancelDialog(false);
      toast.success("Заказ отменён");
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка при отмене заказа");
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case "NEW":
      case "BROADCAST":
        return {
          label: "Ищем водителя",
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          color: "text-yellow-500",
          bg: "bg-yellow-500/10"
        };
      case "ASSIGNED":
        return {
          label: "Водитель назначен",
          icon: <CheckCircle className="w-5 h-5" />,
          color: "text-green-500",
          bg: "bg-green-500/10"
        };
      case "COMPLETED":
        return {
          label: "Завершён",
          icon: <CheckCircle className="w-5 h-5" />,
          color: "text-gray-500",
          bg: "bg-gray-500/10"
        };
      case "CANCELLED":
        return {
          label: "Отменён",
          icon: <AlertCircle className="w-5 h-5" />,
          color: "text-red-500",
          bg: "bg-red-500/10"
        };
      default:
        return {
          label: status,
          icon: <Clock className="w-5 h-5" />,
          color: "text-gray-500",
          bg: "bg-gray-500/10"
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#2AABEE] mx-auto" />
          <p className="mt-4 text-white/60">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Phone request screen
  if (needsPhone) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col" data-testid="phone-request-screen">
        {/* Background */}
        <div className="absolute inset-0 map-placeholder opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0f0f]" />
        
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
          <div className="bg-[#1c1c1e] rounded-2xl p-8 max-w-sm w-full border border-white/5 text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-[#2AABEE]/20 flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-10 h-10 text-[#2AABEE]" />
            </div>
            
            {/* Title */}
            <h1 className="text-xl font-bold mb-2">Нужен номер телефона</h1>
            <p className="text-white/60 text-sm mb-6">
              Для оформления заказа такси необходимо предоставить ваш номер телефона. 
              Водитель сможет связаться с вами при необходимости.
            </p>
            
            {/* Request button */}
            <Button
              onClick={requestPhone}
              disabled={requestingPhone}
              className="w-full h-12 rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold shadow-lg shadow-[#2AABEE]/20 active:scale-95 transition-all"
              data-testid="request-phone-btn"
            >
              {requestingPhone ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Запрос...
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5 mr-2" />
                  Предоставить номер телефона
                </>
              )}
            </Button>
            
            <p className="text-white/40 text-xs mt-4">
              Нажмите кнопку и подтвердите отправку номера в Telegram
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col" data-testid="mini-app-container">
      {/* Map placeholder background */}
      <div className="absolute inset-0 map-placeholder opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0f0f]" />
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="glass rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#2AABEE] flex items-center justify-center">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-bold">Такси</h1>
                <p className="text-white/60 text-xs">
                  {user?.first_name ? `Привет, ${user.first_name}!` : "Быстро и удобно"}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Order Panel - сразу под хедером */}
        <div className="flex-1 px-4 pb-4" data-testid="order-panel">
          <div className="bg-[#1c1c1e] rounded-2xl p-5 h-full border border-white/5">
          {activeOrder && ["NEW", "BROADCAST", "ASSIGNED"].includes(activeOrder.status) ? (
            // Active order view
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Ваш заказ</h2>
                {["NEW", "BROADCAST"].includes(activeOrder.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => setShowCancelDialog(true)}
                    data-testid="cancel-order-btn"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Отменить
                  </Button>
                )}
              </div>
              
              {/* Status badge */}
              {(() => {
                const status = getStatusInfo(activeOrder.status);
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-xl ${status.bg}`} data-testid="order-status">
                    <span className={status.color}>{status.icon}</span>
                    <span className={`font-medium ${status.color}`}>{status.label}</span>
                  </div>
                );
              })()}
              
              {/* Route info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Откуда</p>
                    <p className="font-medium">{activeOrder.address_from}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Куда</p>
                    <p className="font-medium">{activeOrder.address_to}</p>
                  </div>
                </div>
                
                {activeOrder.comment && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-white/60 text-xs">Комментарий</p>
                      <p className="font-medium">{activeOrder.comment}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Driver info (when assigned) */}
              {activeOrder.status === "ASSIGNED" && activeOrder.driver_name && (
                <div className="mt-4 p-4 rounded-xl bg-[#2c2c2e] border border-white/5" data-testid="driver-info">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#2AABEE] flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{activeOrder.driver_name}</p>
                      {activeOrder.driver_car && (
                        <p className="text-sm text-white/60 mt-0.5">🚗 {activeOrder.driver_car}</p>
                      )}
                      {activeOrder.driver_phone && (
                        <a 
                          href={`tel:${activeOrder.driver_phone}`}
                          className="flex items-center gap-1 text-[#2AABEE] text-sm mt-1"
                        >
                          <Phone className="w-3 h-3" />
                          {activeOrder.driver_phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Create order form
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <h2 className="font-semibold text-lg">Куда едем?</h2>
              
              <div className="space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  <Input
                    placeholder="Откуда"
                    value={addressFrom}
                    onChange={(e) => setAddressFrom(e.target.value)}
                    className="pl-11 h-12 bg-[#2c2c2e] border-transparent focus:border-[#2AABEE]/50 rounded-xl"
                    data-testid="address-from-input"
                  />
                </div>
                
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                  <Input
                    placeholder="Куда"
                    value={addressTo}
                    onChange={(e) => setAddressTo(e.target.value)}
                    className="pl-11 h-12 bg-[#2c2c2e] border-transparent focus:border-[#2AABEE]/50 rounded-xl"
                    data-testid="address-to-input"
                  />
                </div>
                
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                  <Textarea
                    placeholder="Комментарий (необязательно)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="pl-11 min-h-[60px] bg-[#2c2c2e] border-transparent focus:border-[#2AABEE]/50 rounded-xl resize-none"
                    data-testid="comment-input"
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={submitting || !addressFrom.trim() || !addressTo.trim()}
                className="w-full h-12 rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold shadow-lg shadow-[#2AABEE]/20 active:scale-95 transition-all"
                data-testid="submit-order-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Создание заказа...
                  </>
                ) : (
                  "Заказать такси"
                )}
              </Button>
            </form>
          )}
          </div>
        </div>
      </div>
      
      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-[#1c1c1e] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Вы уверены, что хотите отменить заказ? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#2c2c2e] border-transparent hover:bg-[#3c3c3e]">
              Нет, оставить
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-red-500 hover:bg-red-600"
              data-testid="confirm-cancel-btn"
            >
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
