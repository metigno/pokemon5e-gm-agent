const ID_RE = /^[A-Za-z0-9_-]+$/;

function cloneStock(stock) {
  return Object.fromEntries(Object.entries(stock).map(([itemId, quantity]) => [itemId, quantity]));
}

function assertShopDefinition(shopId, definition) {
  if (!ID_RE.test(shopId)) throw new Error(`Invalid shop id: ${shopId}`);
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new Error(`Invalid shop definition: ${shopId}`);
  }
  if (!Number.isInteger(definition.refreshEveryDays) || definition.refreshEveryDays < 1) {
    throw new Error(`Shop ${shopId} requires refreshEveryDays >= 1`);
  }
  if (!definition.stock || typeof definition.stock !== "object" || Array.isArray(definition.stock)) {
    throw new Error(`Shop ${shopId} requires stock`);
  }
  for (const [itemId, quantity] of Object.entries(definition.stock)) {
    if (!ID_RE.test(itemId) || !Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Invalid stock entry for ${shopId}: ${itemId}`);
    }
  }
}

function refreshCycle(day, refreshEveryDays) {
  if (!Number.isInteger(day) || day < 1) throw new Error("World day must be >= 1");
  return Math.floor((day - 1) / refreshEveryDays);
}

export function ensureSceneShops(state, shops = undefined) {
  if (shops === undefined) return state;
  if (!shops || typeof shops !== "object" || Array.isArray(shops)) {
    throw new Error("Scene shops must be an object");
  }

  state.shops ??= {};
  for (const [shopId, definition] of Object.entries(shops)) {
    assertShopDefinition(shopId, definition);
    const cycle = refreshCycle(state.world.day, definition.refreshEveryDays);
    const existing = state.shops[shopId];

    if (!existing || existing.refreshCycle !== cycle) {
      state.shops[shopId] = {
        id: shopId,
        refreshEveryDays: definition.refreshEveryDays,
        refreshCycle: cycle,
        lastRefreshDay: state.world.day,
        stock: cloneStock(definition.stock)
      };
    }
  }
  return state;
}

export function applyPurchaseItem(state, effect) {
  const quantity = effect.quantity ?? 1;
  const totalCost = effect.cost * quantity;

  state.player.money ??= 0;
  state.player.inventory ??= [];

  let shop = null;
  if (effect.shopId !== undefined) {
    shop = state.shops?.[effect.shopId];
    if (!shop) throw new Error(`Shop is not initialized: ${effect.shopId}`);
    const available = shop.stock?.[effect.itemId] ?? 0;
    if (available < quantity) {
      throw new Error(`Insufficient stock for ${effect.itemId}: need ${quantity}, have ${available}`);
    }
  }

  if (state.player.money < totalCost) {
    throw new Error(`Insufficient funds for ${effect.itemId}: need ₽${totalCost}, have ₽${state.player.money}`);
  }

  state.player.money -= totalCost;
  if (shop) shop.stock[effect.itemId] -= quantity;
  for (let index = 0; index < quantity; index += 1) {
    state.player.inventory.push(effect.itemId);
  }
  return state;
}
