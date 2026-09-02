"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, Search, Trash2, Plus, Minus, Receipt } from "lucide-react";

type Product = {
  id: string;
  name: string;
  stockCode: string;
  stockQuantity: number;
  costPrice: number;
};

type CartItem = Product & {
  cartId: string;
  quantity: number;
  unitPrice: number;
};

type Sale = {
  id: string;
  createdAt: string;
  itemsCount: number;
  total: number;
  paymentMethod: string;
};

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.trim().length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/products?search=${encodeURIComponent(searchTerm)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadTodaySales = useCallback(async () => {
    try {
      const res = await fetch("/api/pos");
      if (res.ok) {
        const data = await res.json();
        setTodaySales(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadTodaySales();
  }, [loadTodaySales]);

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, cartId: Math.random().toString(), quantity: 1, unitPrice: product.costPrice || 0 }]);
    }
    setSearchTerm("");
    setSearchResults([]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const updatePrice = (id: string, price: number) => {
    setCart(cart.map(item => item.id === id ? { ...item, unitPrice: price } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const total = Math.max(0, subtotal - discount);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: "Erro", description: "O carrinho está vazio.", variant: "destructive" });
      return;
    }
    if (!paymentMethod) {
      toast({ title: "Erro", description: "Selecione uma forma de pagamento.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map(item => ({ productId: item.id, quantity: item.quantity, unitPrice: item.unitPrice })),
        paymentMethod,
        discount,
      };

      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: "Sucesso", description: "Venda finalizada com sucesso." });
        setCart([]);
        setPaymentMethod("");
        setDiscount(0);
        loadTodaySales();
      } else {
        throw new Error("Falha ao finalizar");
      }
    } catch (error) {
      toast({ title: "Erro", description: "Ocorreu um erro ao finalizar a venda.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const todaySalesTotal = todaySales.reduce((acc, sale) => acc + sale.total, 0);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">🏪 Balcão / PDV</h2>
          <p className="text-muted-foreground">Venda rápida no balcão</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Left Column: POS */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Novo Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar produto por nome ou código..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg dark:bg-zinc-950 max-h-60 overflow-auto">
                    {searchResults.map(product => (
                      <div 
                        key={product.id} 
                        className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center border-b last:border-0"
                        onClick={() => addToCart(product)}
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">Cód: {product.stockCode}</p>
                        </div>
                        <div className="text-right">
                          <p>{formatCurrency(product.costPrice)}</p>
                          <p className="text-xs text-muted-foreground">Estoque: {product.stockQuantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Produto</th>
                      <th className="p-3 text-center font-medium">Qtd</th>
                      <th className="p-3 text-right font-medium">Preço (R$)</th>
                      <th className="p-3 text-right font-medium">Subtotal</th>
                      <th className="p-3 text-center font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">Carrinho vazio</td>
                      </tr>
                    ) : (
                      cart.map((item) => (
                        <tr key={item.cartId} className="border-t">
                          <td className="p-3">{item.name}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-4 text-center">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <Input 
                              type="number" 
                              value={item.unitPrice || ""} 
                              onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                              className="w-20 text-right ml-auto h-8"
                            />
                          </td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Forma de Pagamento</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                      <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Desconto (R$)</label>
                  <Input 
                    type="number" 
                    value={discount || ""} 
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Desconto</span>
                    <span>- {formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white" 
                size="lg"
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
              >
                {isSubmitting ? "Processando..." : "Finalizar Venda"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Today's Sales */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2"><Receipt className="w-5 h-5"/> Vendas de Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-3xl font-bold">{formatCurrency(todaySalesTotal)}</p>
                <p className="text-sm text-muted-foreground">{todaySales.length} venda(s) registrada(s)</p>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-auto">
                {todaySales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda hoje.</p>
                ) : (
                  todaySales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{formatCurrency(sale.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleTimeString()} • {sale.itemsCount} item(s) • {sale.paymentMethod}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
