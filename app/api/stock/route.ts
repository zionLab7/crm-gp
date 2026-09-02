export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const lowStockOnly = searchParams.get("lowStock") === "true";
        const productId = searchParams.get("productId");

        if (productId) {
            const movements = await prisma.stockMovement.findMany({
                where: { productId },
                include: {
                    product: { select: { name: true, stockCode: true } },
                    user: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
            });
            return NextResponse.json({ movements });
        }

        const products = await prisma.product.findMany({
            select: {
                id: true, name: true, stockCode: true,
                stockQuantity: true, minStockLevel: true, unit: true, costPrice: true,
            },
            orderBy: { name: "asc" },
        });

        const result = lowStockOnly
            ? products.filter(p => p.stockQuantity <= p.minStockLevel)
            : products;

        return NextResponse.json({
            products: result,
            lowStockCount: products.filter(p => p.stockQuantity <= p.minStockLevel && p.minStockLevel > 0).length,
        });
    } catch (error: any) {
        console.error("Erro ao buscar estoque:", error);
        return NextResponse.json({ error: error.message || "Erro" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!dbUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });

        const { productId, type, quantity, reason } = await request.json();
        if (!productId || !type || !quantity) {
            return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
        }

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

        let newQuantity = product.stockQuantity;
        if (type === "IN") newQuantity += quantity;
        else if (type === "OUT") newQuantity = Math.max(0, newQuantity - quantity);
        else if (type === "ADJUSTMENT") newQuantity = quantity;

        const [movement] = await prisma.$transaction([
            prisma.stockMovement.create({
                data: { productId, type, quantity, reason: reason || null, userId: dbUser.id },
            }),
            prisma.product.update({
                where: { id: productId },
                data: { stockQuantity: newQuantity },
            }),
        ]);

        return NextResponse.json({ success: true, movement, newQuantity });
    } catch (error: any) {
        console.error("Erro ao registrar movimento:", error);
        return NextResponse.json({ error: error.message || "Erro" }, { status: 500 });
    }
}
