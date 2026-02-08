import { useState, useEffect } from "react";
import axios from "axios";
import { Search, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await axios.get(`${API}/admin/clients`);
        setClients(res.data);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.telegram_id.toLowerCase().includes(query) ||
      client.first_name?.toLowerCase().includes(query) ||
      client.last_name?.toLowerCase().includes(query) ||
      client.username?.toLowerCase().includes(query)
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
    <div className="space-y-6" data-testid="admin-clients">
      <div>
        <h1 className="text-2xl font-bold">Клиенты</h1>
        <p className="text-white/60 mt-1">Список клиентов</p>
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <Input
          placeholder="Поиск клиента..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#1c1c1e] border-white/10"
          data-testid="search-clients-input"
        />
      </div>
      
      {/* Clients Table */}
      <Card className="bg-[#1c1c1e] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-white/60 font-medium">Telegram ID</th>
                <th className="text-left p-4 text-white/60 font-medium">Имя</th>
                <th className="text-left p-4 text-white/60 font-medium">Username</th>
                <th className="text-left p-4 text-white/60 font-medium">Дата регистрации</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">Клиентов не найдено</p>
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <span className="font-mono text-sm">{client.telegram_id}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Users className="w-4 h-4 text-purple-500" />
                        </div>
                        <span>
                          {client.first_name || '—'}
                          {client.last_name && ` ${client.last_name}`}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-white/60">
                      {client.username ? `@${client.username}` : '—'}
                    </td>
                    <td className="p-4 text-sm text-white/60">
                      {new Date(client.created_at).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
