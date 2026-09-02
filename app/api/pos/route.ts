export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
        const startOfDay = new Date(dateStr + "T00:00:00");
        const endOfDay = new Date(dateStr + "T23:59:59.999");

        const sales = await prisma.interaction.findMany({
            where: {
                channel: "BALCAO",
                createdAt: { gte: startOfDay, lte: endOfDay },
            },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        });

        const parsedSales = sales.map(s => {
            let meta: any = {};
            try { meta = JSON.parse(s.metadata || "{}"); } catch {}
            return {
                id: s.id,
                createdAt: s.createdAt,
                vendedor: s.user.name,
                items: meta.items || [],
                saleValue: meta.saleValue || 0,
                paymentMethod: meta.paymentMethod || "—",
            };
        });

        const totalDia = parsedSales.reduce((sum, s) => sum + s.saleValue, 0);

        return NextResponse.json({ sales: parsedSales, totalDia, count: parsedSales.length });
    } catch (error: any) {
        console.error("Erro ao buscar vendas balcão:", error);
        return NextResponse.json({ error: error.message || "Erro" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!dbUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });

        const { items, paymentMethod, discount, notes } = await request.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "Nenhum item informado" }, { status: 400 });
        }

        // Validate stock and calculate total
        let saleValue = 0;
        const validatedItems: any[] = [];

        for (const item of items) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });
            if (!product) {
                return NextResponse.json({ error: `Produto '${item.productName}' não encontrado` }, { status: 404 });
            }
            if (product.stockQuantity < item.quantity) {
                return NextResponse.json({
                    error: `Estoque insuficiente para '${product.name}'. Disponível: ${product.stockQuantity} ${product.unit}`,
                }, { status: 400 });
            }
            const itemTotal = item.unitPrice * item.quantity;
            saleValue += itemTotal;
            validatedItems.push({
                productId: product.id,
                productName: product.name,
                stockCode: product.stockCode,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: itemTotal,
            });
        }

        // Apply discount
        const discountValue = discount || 0;
        saleValue = Math.max(0, saleValue - discountValue);

        // Transaction: create interaction + stock movements
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the POS interaction (no clientId)
            const interaction = await tx.interaction.create({
                data: {
                    type: "Venda Balcão",
                    channel: "BALCAO",
                    description: `Venda balcão: ${validatedItems.length} item(ns) — ${paymentMethod || "Não informado"}`,
                    metadata: JSON.stringify({
                        saleType: "POS",
                        saleValue,
                        items: validatedItems,
                        paymentMethod: paymentMethod || "Dinheiro",
                        discount: discountValue,
                        notes: notes || "",
                    }),
                    userId: dbUser.id,
                },
            });

            // 2. Deduct stock for each item
            for (const item of validatedItems) {
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        type: "OUT",
                        quantity: item.quantity,
                        reason: "Venda Balcão",
                        referenceId: interaction.id,
                        userId: dbUser.id,
                    },
                });
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
            }

            return interaction;
        });

        return NextResponse.json({ success: true, saleId: result.id, saleValue });
    } catch (error: any) {
        console.error("Erro ao processar venda balcão:", error);
        return NextResponse.json({ error: error.message || "Erro" }, { status: 500 });
    }
}
