/**
 * WaterBoi Commission Logic
 * Calculates employee payout based on service pricing and commission rate (default 27%)
 */

export const DEFAULT_COMMISSION_RATE = 0.27; // 27%

export function calculateCommission({ jugCount, pricePerJug, commissionRate = DEFAULT_COMMISSION_RATE }) {
  const count = Math.max(0, parseInt(jugCount, 10) || 0);
  const price = Math.max(0, parseFloat(pricePerJug) || 0);
  const rate = Math.max(0, parseFloat(commissionRate) || DEFAULT_COMMISSION_RATE);

  const totalPrice = count * price;
  const commissionAmount = totalPrice * rate;
  const stationAmount = totalPrice - commissionAmount;

  return {
    jugCount: count,
    pricePerJug: price,
    totalPrice: parseFloat(totalPrice.toFixed(2)),
    commissionRate: rate,
    commissionAmount: parseFloat(commissionAmount.toFixed(2)),
    stationAmount: parseFloat(stationAmount.toFixed(2))
  };
}
