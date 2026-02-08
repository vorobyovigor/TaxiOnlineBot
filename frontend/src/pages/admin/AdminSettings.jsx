import { useState, useEffect } from "react";
import axios from "axios";
import { Settings, MessageSquare, Loader2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatId, setChatId] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API}/admin/settings`);
        setSettings(res.data);
        setChatId(res.data.drivers_chat_id || "");
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveChatId = async () => {
    if (!chatId.trim()) {
      toast.error("Введите Chat ID");
      return;
    }
    
    try {
      setSaving(true);
      await axios.post(`${API}/admin/settings/drivers-chat`, {
        chat_id: chatId.trim()
      });
      toast.success("Chat ID сохранён");
    } catch (error) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${process.env.REACT_APP_BACKEND_URL}/api/telegram/webhook`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Скопировано!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2AABEE]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-settings">
      <div>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-white/60 mt-1">Конфигурация системы</p>
      </div>
      
      {/* Bot Status */}
      <Card className="bg-[#1c1c1e] border-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-[#2AABEE]" />
          <h2 className="font-semibold">Статус бота</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            settings?.bot_configured ? "bg-green-500" : "bg-red-500"
          }`} />
          <span className="text-white/80">
            {settings?.bot_configured ? "Бот настроен" : "Бот не настроен"}
          </span>
        </div>
      </Card>
      
      {/* Drivers Chat ID */}
      <Card className="bg-[#1c1c1e] border-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-[#2AABEE]" />
          <h2 className="font-semibold">Чат водителей</h2>
        </div>
        
        <p className="text-white/60 text-sm mb-4">
          ID группы Telegram, куда будут отправляться заказы.
          Добавьте бота в группу и дайте ему права администратора.
        </p>
        
        <div className="flex gap-3">
          <Input
            placeholder="-1001234567890"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="bg-[#2c2c2e] border-white/10"
            data-testid="chat-id-input"
          />
          <Button
            onClick={handleSaveChatId}
            disabled={saving}
            className="bg-[#2AABEE] hover:bg-[#229ED9] px-6"
            data-testid="save-chat-id-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-yellow-500 text-sm">
            <strong>Как узнать Chat ID:</strong>
          </p>
          <ol className="text-yellow-500/80 text-sm mt-2 space-y-1 list-decimal list-inside">
            <li>Добавьте @RawDataBot в группу</li>
            <li>Он отправит сообщение с chat id</li>
            <li>Скопируйте и вставьте сюда</li>
            <li>Удалите @RawDataBot из группы</li>
          </ol>
        </div>
      </Card>
      
      {/* Webhook URL */}
      <Card className="bg-[#1c1c1e] border-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-[#2AABEE]" />
          <h2 className="font-semibold">Webhook URL</h2>
        </div>
        
        <p className="text-white/60 text-sm mb-4">
          Установите этот URL как webhook для вашего бота:
        </p>
        
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#2c2c2e] font-mono text-sm">
          <code className="flex-1 truncate text-white/80">{webhookUrl}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(webhookUrl)}
            data-testid="copy-webhook-btn"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-blue-400 text-sm">
            <strong>Команда для установки webhook:</strong>
          </p>
          <code className="text-blue-400/80 text-xs mt-2 block break-all">
            curl -X POST "https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={webhookUrl}"
          </code>
        </div>
      </Card>
    </div>
  );
}
