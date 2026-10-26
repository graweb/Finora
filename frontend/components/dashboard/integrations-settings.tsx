"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Eraser,
  History,
  LoaderCircle,
  RefreshCw,
  ServerCog,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notifyRecommendationCacheCleared } from "./cache-events";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type IntegrationStatus = {
  redis_online: boolean;
  cached_funds: number;
  fund_cache_ttl: number;
  recommendation_ttl: number;
  total_funds: number;
  history: { created_at: string; total: number; status: string }[];
};

const emptyStatus: IntegrationStatus = {
  redis_online: false,
  cached_funds: 0,
  fund_cache_ttl: 0,
  recommendation_ttl: 0,
  total_funds: 0,
  history: [],
};

function hours(seconds: number) {
  return seconds > 0 ? `${Math.max(1, Math.ceil(seconds / 3600))}h` : "—";
}

export function IntegrationsSettings() {
  const [data, setData] = useState(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/settings/integrations`);
      if (!response.ok) throw new Error();
      setData((await response.json()) as IntegrationStatus);
    } catch {
      toast.error("Não foi possível carregar as integrações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const syncAll = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${apiUrl}/settings/integrations/sync`, {
        method: "POST",
      });
      const body = (await response.json()) as { detail?: string; total?: number };
      if (!response.ok) throw new Error(body.detail ?? "Não foi possível sincronizar.");
      toast.success(`${body.total ?? 0} FII(s) foram agendados para sincronização.`);
      window.setTimeout(() => void load(), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  const clear = async (target: "funds" | "recommendations" | "all") => {
    setClearing(target);
    const path = target === "all" ? "cache" : `cache/${target}`;
    try {
      const response = await fetch(`${apiUrl}/settings/integrations/${path}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      if (target === "recommendations" || target === "all") {
        notifyRecommendationCacheCleared();
      }
      toast.success("Cache limpo com sucesso.");
      await load();
    } catch {
      toast.error("Não foi possível limpar o cache.");
    } finally {
      setClearing(null);
    }
  };

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Crawler · Funds Explorer</h2>
              <p className="mt-1 text-sm text-zinc-400">Consulta dados e eventos dos FIIs em segundo plano.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400"><span className="size-2 rounded-full bg-emerald-400" />Ativo</span>
          </div>
          <div className="mt-5 space-y-3 border-y border-[#3b3a62] py-4 text-sm">
            <Metric label="FIIs cadastrados" value={loading ? "…" : String(data.total_funds)} />
            <Metric label="FIIs em cache" value={loading ? "…" : String(data.cached_funds)} />
            <Metric label="Processamento" value="Em segundo plano" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="h-10 bg-sky-500 text-slate-950 hover:bg-sky-400" disabled={syncing || !data.total_funds} onClick={() => void syncAll()}>
              <RefreshCw className={syncing ? "animate-spin" : ""} />{syncing ? "Sincronizando" : "Sincronizar agora"}
            </Button>
            <Button className="h-10 border-[#565487] text-zinc-200 hover:bg-[#302e67]" variant="outline"><History />Ver histórico</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Cache Redis</h2><p className="mt-1 text-sm text-zinc-400">Acelera os cálculos e reduz consultas externas.</p></div><StatusBadge online={data.redis_online} /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Cache de FIIs" value={String(data.cached_funds)} />
            <Stat label="Carteira sugerida" value={hours(data.recommendation_ttl)} />
            <Stat label="Validade dos FIIs" value={hours(data.fund_cache_ttl)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <ClearButton busy={clearing === "funds"} label="Limpar cache FIIs" onClick={() => void clear("funds")} />
            <ClearButton busy={clearing === "recommendations"} label="Limpar recomendação" onClick={() => void clear("recommendations")} />
            <Button className="h-10 text-red-400 hover:bg-red-500/10 hover:text-red-300" disabled={clearing !== null} variant="ghost" onClick={() => void clear("all")}><Trash2 />Limpar tudo</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5"><h2 className="text-lg font-semibold text-white">Fontes de dados</h2><p className="mt-1 text-sm text-zinc-400">Defina a prioridade das fontes usadas nas consultas.</p><div className="mt-5 space-y-2"><SourceRow index="1" name="Funds Explorer" detail="Fonte principal (crawler)" active /><SourceRow index="2" name="Dados de Mercado" detail="Fonte alternativa futura" /></div><p className="mt-4 text-xs text-zinc-500">O Funds Explorer é a fonte primária de dados do sistema.</p></CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none">
        <CardContent className="p-5"><h2 className="text-lg font-semibold text-white">Configuração do crawler</h2><p className="mt-1 text-sm text-zinc-400">Ajuste o comportamento da sincronização em segundo plano.</p><div className="mt-5 space-y-3 text-sm"><SettingRow icon={<ServerCog />} label="Sincronizações em segundo plano" value="Ativadas" /><SettingRow icon={<Database />} label="Intervalo de cache" value="24 horas" /><SettingRow icon={<RefreshCw />} label="URL de consulta" value="fundsexplorer.com.br/funds/{ticker}" /></div></CardContent>
      </Card>

      <Card className="border-[#36366c] bg-[#222153] py-0 shadow-none xl:col-span-2"><CardContent className="p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Histórico de sincronização</h2><p className="mt-1 text-sm text-zinc-400">Últimas execuções do crawler e seus resultados.</p></div><Button className="h-10 border-[#565487] text-zinc-200 hover:bg-[#302e67]" variant="outline"><History />Ver histórico completo</Button></div><div className="mt-5 overflow-hidden rounded-md border border-[#3b3a62]"><table className="w-full text-left text-sm"><thead className="bg-[#181642] text-zinc-300"><tr><th className="px-4 py-3 font-semibold">Data</th><th className="px-4 py-3 font-semibold">Origem</th><th className="px-4 py-3 font-semibold">FIIs</th><th className="px-4 py-3 font-semibold">Resultado</th></tr></thead><tbody>{data.history.length ? data.history.map((item) => <tr className="border-t border-[#3b3a62] text-zinc-300" key={item.created_at}><td className="px-4 py-3">{new Date(item.created_at).toLocaleString("pt-BR")}</td><td className="px-4 py-3">Funds Explorer</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="size-4" />{item.status}</span></td></tr>) : <tr><td className="px-4 py-6 text-center text-zinc-500" colSpan={4}>Nenhuma sincronização registrada.</td></tr>}</tbody></table></div></CardContent></Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 text-zinc-400"><span>{label}</span><strong className="font-medium text-white">{value}</strong></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-[#3b3a62] bg-[#181642] p-3"><p className="text-xs text-zinc-400">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p></div>; }
function StatusBadge({ online }: { online: boolean }) { return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${online ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}><span className={`size-2 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />{online ? "Online" : "Indisponível"}</span>; }
function ClearButton({ busy, label, onClick }: { busy: boolean; label: string; onClick: () => void }) { return <Button className="h-10 border-[#565487] text-zinc-200 hover:bg-[#302e67]" disabled={busy} variant="outline" onClick={onClick}>{busy ? <LoaderCircle className="animate-spin" /> : <Eraser />}{label}</Button>; }
function SourceRow({ index, name, detail, active = false }: { index: string; name: string; detail: string; active?: boolean }) { return <div className="flex items-center gap-3 rounded-md border border-[#3b3a62] bg-[#181642] p-3"><span className="grid size-7 place-items-center rounded-full bg-[#302e67] text-xs text-zinc-300">{index}</span><div className="min-w-0 flex-1"><p className="font-medium text-white">{name}</p><p className="text-xs text-zinc-500">{detail}</p></div><span className={active ? "text-xs text-emerald-400" : "text-xs text-zinc-500"}>{active ? "Ativa" : "Não configurada"}</span></div>; }
function SettingRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-md border border-[#3b3a62] bg-[#181642] px-3 py-2.5 text-zinc-400"><span className="text-sky-400">{icon}</span><span className="flex-1 text-zinc-200">{label}</span><span className="text-xs text-zinc-400">{value}</span></div>; }
