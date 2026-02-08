import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [telegramId, setTelegramId] = useState("");
  const [username, setUsername] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!telegramId.trim()) {
      toast.error("Введите Telegram ID");
      return;
    }
    
    try {
      setLoading(true);
      
      const res = await axios.post(`${API}/admin/auth`, {
        telegram_id: telegramId.trim(),
        username: username.trim() || null,
        first_name: username.trim() || "Admin",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "demo_hash"
      });
      
      // Save admin info to localStorage
      localStorage.setItem("admin_token", res.data.token);
      localStorage.setItem("admin_data", JSON.stringify(res.data.admin));
      
      toast.success("Вход выполнен!");
      navigate("/admin");
      
    } catch (error) {
      toast.error("Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4" data-testid="admin-login-page">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#2AABEE]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#EAB308]/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#1c1c1e] rounded-2xl border border-white/5 p-8 shadow-xl">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#2AABEE] flex items-center justify-center">
              <Car className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-white mb-2">
            Админ-панель
          </h1>
          <p className="text-white/60 text-center mb-8">
            Служба такси
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-2 block">Telegram ID</label>
              <Input
                type="text"
                placeholder="Ваш Telegram ID"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="h-12 bg-[#2c2c2e] border-transparent focus:border-[#2AABEE]/50 rounded-xl"
                data-testid="telegram-id-input"
              />
            </div>
            
            <div>
              <label className="text-sm text-white/60 mb-2 block">Имя (опционально)</label>
              <Input
                type="text"
                placeholder="Ваше имя"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-[#2c2c2e] border-transparent focus:border-[#2AABEE]/50 rounded-xl"
                data-testid="username-input"
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold shadow-lg shadow-[#2AABEE]/20 active:scale-95 transition-all"
              data-testid="login-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Вход...
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </form>
          
          <p className="text-white/40 text-xs text-center mt-6">
            Для демо: введите любой Telegram ID
          </p>
        </div>
      </div>
    </div>
  );
}
