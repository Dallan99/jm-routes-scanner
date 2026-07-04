import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { listarBasesComResumo, importarEscala, listarEscalaPorBase, type BaseResumo } from "@/lib/bases.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Upload, Package, FileSpreadsheet, Eye, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bases")({
  head: () => ({ meta: [{ title: "Bases — JM Transportes" }] }),
  component: BasesPage,
});

type LinhaEscala = {
  planejada: string | null;
  otimizada: string | null;
  pacotes: number | null;
  paradas: number | null;
  modal: string | null;
  bairro: string | null;
  cidade: string | null;
  giro: string | null;
  vaga: string | null;
  tipo: string | null;
  roteiro: string | null;
  placa: string | null;
  driver: string | null;
  placa_troca: string | null;
};

function BasesPage() {
  const listar = useServerFn(listarBasesComResumo);
  const q = useQuery({ queryKey: ["bases-resumo"], queryFn: () => listar(), refetchInterval: 30_000 });
  const [importBase, setImportBase] = useState<BaseResumo | null>(null);
  const [viewBase, setViewBase] = useState<BaseResumo | null>(null);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Bases JM</h1>
        <p className="text-sm text-muted-foreground">Visão por base e importação manual de escalas (XLSX/CSV).</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(q.data ?? []).map((b) => (
          <BaseCard key={b.id} b={b} onImport={() => setImportBase(b)} onView={() => setViewBase(b)} />
        ))}
        {q.isLoading && <div className="text-sm text-muted-foreground">Carregando bases…</div>}
      </div>

      {importBase && (
        <ImportDialog base={importBase} onClose={() => setImportBase(null)} />
      )}
      {viewBase && (
        <ViewDialog base={viewBase} onClose={() => setViewBase(null)} />
      )}
    </div>
  );
}

function BaseCard({ b, onImport, onView }: { b: BaseResumo; onImport: () => void; onView: () => void }) {
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md brand-gradient flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-[var(--brand-yellow)]" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-lg leading-tight truncate">{b.nome}</div>
            <div className="text-xs text-muted-foreground">{b.cidade ?? "—"} {b.uf ? `· ${b.uf}` : ""}</div>
          </div>
        </div>
        <Badge variant="outline" className="font-mono">{b.codigo}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat icon={FileSpreadsheet} label="Escalas" value={b.total_escalas.toLocaleString("pt-BR")} />
        <Stat icon={Package} label="Pacotes" value={b.total_pacotes.toLocaleString("pt-BR")} />
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5" />
        Última importação: {b.ultima_importacao ? new Date(b.ultima_importacao).toLocaleString("pt-BR") : "nunca"}
      </div>

      <div className="flex gap-2 mt-auto">
        <Button onClick={onImport} className="flex-1"><Upload className="w-4 h-4 mr-1.5" />Importar escala</Button>
        <Button onClick={onView} variant="outline" size="icon" aria-label="Ver escala"><Eye className="w-4 h-4" /></Button>
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" />{label}</div>
      <div className="font-display text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

// ---------- Import ----------

const HEADER_MAP: Record<string, keyof LinhaEscala> = {
  planejada: "planejada",
  otimizada: "otimizada",
  pacotes: "pacotes",
  paradas: "paradas",
  modal: "modal",
  bairro: "bairro",
  cidade: "cidade",
  giro: "giro",
  vaga: "vaga",
  tipo: "tipo",
  roteiro: "roteiro",
  placa: "placa",
  driver: "driver",
  motorista: "driver",
  "placa troca": "placa_troca",
  "placa_troca": "placa_troca",
};

function normHeader(h: string) {
  return h
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseFile(file: File): Promise<LinhaEscala[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
        const linhas: LinhaEscala[] = raw.map((r) => {
          const out: LinhaEscala = {
            planejada: null, otimizada: null, pacotes: null, paradas: null,
            modal: null, bairro: null, cidade: null, giro: null, vaga: null,
            tipo: null, roteiro: null, placa: null, driver: null, placa_troca: null,
          };
          for (const [k, v] of Object.entries(r)) {
            const key = HEADER_MAP[normHeader(k)];
            if (!key) continue;
            if (v === null || v === undefined || v === "") continue;
            if (key === "pacotes" || key === "paradas") {
              const n = Number(v);
              out[key] = Number.isFinite(n) ? Math.round(n) : null;
            } else {
              out[key] = String(v).trim() || null;
            }
          }
          return out;
        }).filter((l) => l.planejada || l.otimizada || l.driver || l.placa);
        resolve(linhas);
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function ImportDialog({ base, onClose }: { base: BaseResumo; onClose: () => void }) {
  const qc = useQueryClient();
  const importFn = useServerFn(importarEscala);
  const [linhas, setLinhas] = useState<LinhaEscala[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [substituir, setSubstituir] = useState(true);
  const [dataRef, setDataRef] = useState(new Date().toISOString().slice(0, 10));
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => importFn({ data: { baseId: base.id, dataReferencia: dataRef, substituir, linhas: linhas ?? [] } }),
    onSuccess: (r) => {
      toast.success(`${r.inseridos} linhas importadas em ${base.codigo}.`);
      qc.invalidateQueries({ queryKey: ["bases-resumo"] });
      qc.invalidateQueries({ queryKey: ["escala", base.id] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao importar."),
  });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const ls = await parseFile(file);
      if (!ls.length) {
        toast.warning("Nenhuma linha válida encontrada no arquivo.");
        setLinhas(null);
        return;
      }
      setLinhas(ls);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
      setLinhas(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar escala — {base.codigo}</DialogTitle>
          <DialogDescription>
            Selecione o arquivo XLSX/CSV exportado da planilha da base. Cabeçalhos aceitos: Planejada, Otimizada, Pacotes, Paradas, Modal, Bairro, Cidade, Giro, Vaga, Tipo, Roteiro, Placa, Driver, Placa Troca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition"
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="font-medium">{fileName || "Arraste o arquivo aqui ou clique para selecionar"}</div>
            <div className="text-xs text-muted-foreground mt-1">.xlsx, .xls ou .csv</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data-ref">Data de referência</Label>
              <Input id="data-ref" type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={substituir} onCheckedChange={(v) => setSubstituir(v === true)} />
                Substituir escala existente desta data
              </label>
            </div>
          </div>

          {linhas && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium mb-2">Pré-visualização — {linhas.length} linhas detectadas</div>
              <div className="max-h-48 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Planejada</TableHead>
                      <TableHead>Otim.</TableHead>
                      <TableHead>Pac.</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.slice(0, 50).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{l.planejada}</TableCell>
                        <TableCell className="font-mono text-xs">{l.otimizada}</TableCell>
                        <TableCell>{l.pacotes}</TableCell>
                        <TableCell className="text-xs">{l.driver}</TableCell>
                        <TableCell className="font-mono text-xs">{l.placa}</TableCell>
                        <TableCell className="text-xs">{l.tipo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!linhas || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Importando…" : `Importar ${linhas?.length ?? 0} linhas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- View ----------

function ViewDialog({ base, onClose }: { base: BaseResumo; onClose: () => void }) {
  const fn = useServerFn(listarEscalaPorBase);
  const q = useQuery({ queryKey: ["escala", base.id], queryFn: () => fn({ data: { baseId: base.id } }) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Escala — {base.nome} ({base.codigo})</DialogTitle>
          <DialogDescription>Últimas 500 linhas importadas.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="tabela">
          <TabsList>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="tabela" className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Planejada</TableHead>
                  <TableHead>Otimizada</TableHead>
                  <TableHead>Pac.</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.data_referencia}</TableCell>
                    <TableCell className="font-mono text-xs">{r.planejada}</TableCell>
                    <TableCell className="font-mono text-xs">{r.otimizada}</TableCell>
                    <TableCell>{r.pacotes}</TableCell>
                    <TableCell className="text-xs">{r.driver}</TableCell>
                    <TableCell className="font-mono text-xs">{r.placa}</TableCell>
                    <TableCell className="text-xs">{r.cidade}</TableCell>
                    <TableCell className="text-xs">{r.tipo}</TableCell>
                  </TableRow>
                ))}
                {!q.isLoading && (q.data?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhuma escala importada ainda.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}