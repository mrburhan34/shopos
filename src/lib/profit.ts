// Gross profit helpers — selling price minus product purchase_price * qty.
export type ProfitItem = {
  qty: number | string;
  rate: number | string;
  product_id?: string | null;
  name?: string | null;
};

export type ProductCost = {
  id: string;
  name: string;
  purchase_price: number | string;
};

export function buildProductCostMap(products: ProductCost[]) {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const p of products) {
    const cost = Number(p.purchase_price) || 0;
    byId.set(p.id, cost);
    if (p.name) byName.set(p.name.trim().toLowerCase(), cost);
  }
  return {
    cost(item: ProfitItem): number {
      if (item.product_id && byId.has(item.product_id)) return byId.get(item.product_id)!;
      if (item.name) {
        const c = byName.get(item.name.trim().toLowerCase());
        if (c != null) return c;
      }
      return 0;
    },
  };
}

export function computeGrossProfit(items: ProfitItem[], map: ReturnType<typeof buildProductCostMap>): number {
  let total = 0;
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const cost = map.cost(it);
    total += (rate - cost) * qty;
  }
  return total;
}
