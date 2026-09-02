"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Package, AlertTriangle, CheckCircle, XCircle, Plus } from "lucide-react";

type StockProduct = {
  id: string;
  stockCode: string;
  name: string;
  stockQuantity: number;
  minStock: number;
  unit: string;
};

export default function StockPage() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [filter, setFilter] = useState<"ALL" | "LOW" | "OUT">("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null);
  
  const [entryType, setEntryType] = useState("");
  const [entryQty, setEntryQty] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStock = async () => {
    try {
      const res = await fetch("/api/stock");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const totalProducts = products.length;
  const okStock = products.filter(p => p.stockQuantity > p.minStock).length;
  const lowStock = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.minStock).length;
  const outStock = products.filter(p => p.stockQuantity === 0).length;

  const filteredProducts = products.filter(p => {
    if (filter === "LOW") return p.stockQuantity > 0 && p.stockQuantity <= p.minStock;
    if (filter === "OUT") return p.stockQuantity === 0;
    return true;
  });

  const handleOpenDialog = (product: StockProduct) => {
    setSelectedProduct(product);
    setEntryType("");
    setEntryQty("");
    setEntryReason("");
    setIsDialogOpen(true);
  };

  const handleSubmitEntry = async () => {
    if (!selectedProduct || !entryType || !entryQty) {
      toast({ title: "Erro", description: "Preencha os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          type: entryType,
          quantity: Number(entryQty),
          reason: entryReason
        }),
      });

      if (res.ok) {
        toast({ title: "Sucesso", description: "Movimentação registrada com sucesso." });
        setIsDialogOpen(false);
        loadStock();
      } else {
        throw new Error("Erro ao registrar");
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao registrar movimentação.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">📦 Controle de Estoque</h2>
          <p className="text-muted-foreground">Gerencie o estoque de produtos</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque OK</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{okStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Estoque</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outStock}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button variant={filter === "ALL" ? "default" : "outline"} onClick={() => setFilter("ALL")}>Todos</Button>
        <Button variant={filter === "LOW" ? "default" : "outline"} onClick={() => setFilter("LOW")}>Estoque Baixo</Button>
        <Button variant={filter === "OUT" ? "default" : "outline"} onClick={() => setFilter("OUT")}>Sem Estoque</Button>
      </div>

      <Card>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-left font-medium">Código</th>
                <th className="p-4 text-left font-medium">Produto</th>
                <th className="p-4 text-right font-medium">Qtd Atual</th>
                <th className="p-4 text-right font-medium">Mínimo</th>
                <th className="p-4 text-center font-medium">Status</th>
                <th className="p-4 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stockQuantity === 0;
                  const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStock;
                  
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-4">{p.stockCode}</td>
                      <td className="p-4 font-medium">{p.name}</td>
                      <td className="p-4 text-right">{p.stockQuantity} {p.unit}</td>
                      <td className="p-4 text-right text-muted-foreground">{p.minStock}</td>
                      <td className="p-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Zerado</span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Baixo</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">OK</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleOpenDialog(p)}>
                          <Plus className="h-3 w-3" /> Movimento
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimentação de Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Input value={selectedProduct?.name || ""} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Saída</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input 
                  type="number" 
                  value={entryQty} 
                  onChange={(e) => setEntryQty(e.target.value)} 
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input 
                value={entryReason} 
                onChange={(e) => setEntryReason(e.target.value)} 
                placeholder="Ex: Compra, Perda, Acerto..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitEntry} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
