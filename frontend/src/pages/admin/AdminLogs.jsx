import { useState, useEffect } from "react";
import axios from "axios";
import { ScrollText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ACTION_LABELS = {
  ORDER_CREATED: { label: "Заказ создан", color: "text-blue-500" },
  ORDER_BROADCAST: { label: "Заказ отправлен", color: "text-yellow-500" },
  ORDER_ASSIGNED: { label: "Водитель назначен", color: "text-green-500" },
  ORDER_COMPLETED: { label: "Заказ завершён", color: "text-gray-400" },
  ORDER_CANCELLED: { label: "Заказ отменён", color: "text-red-500" },
  DRIVER_REGISTERED: { label: "Водитель зарегистрирован", color: "text-purple-500" },
  DRIVER_BLOCKED: { label: "Водитель заблокирован", color: "text-red-500" },
  DRIVER_UNBLOCKED: { label: "Водитель разблокирован", color: "text-green-500" },
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${API}/admin/logs`);
        setLogs(res.data);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2AABEE]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-logs">
      <div>
        <h1 className="text-2xl font-bold">Логи</h1>
        <p className="text-white/60 mt-1">История действий</p>
      </div>
      
      <Card className="bg-[#1c1c1e] border-white/5 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center">
            <ScrollText className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Логов пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map(log => {
              const actionInfo = ACTION_LABELS[log.action_type] || { label: log.action_type, color: "text-white" };
              return (
                <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/60">
                        {log.order_id && (
                          <span>Заказ: <span className="font-mono">#{log.order_id.slice(0, 8)}</span></span>
                        )}
                        {log.driver_id && (
                          <span>Водитель: <span className="font-mono">#{log.driver_id.slice(0, 8)}</span></span>
                        )}
                        {log.client_id && (
                          <span>Клиент: <span className="font-mono">#{log.client_id.slice(0, 8)}</span></span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-sm text-white/40 mt-1">{log.details}</p>
                      )}
                    </div>
                    <p className="text-xs text-white/40 flex-shrink-0">
                      {new Date(log.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
