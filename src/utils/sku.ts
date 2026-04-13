export function generateSKU({
  name,
  color,
  size,
  sellerId,
}: {
  name: string;
  color?: string;
  size?: string;
  sellerId: string;
}) {
  const namePart = name
    .replace(/[^A-Z0-9]/gi, "")
    .substring(0, 3)
    .toUpperCase();
  const colorPart = color?.substring(0, 3).toUpperCase() || "DEF";
  const sizePart = size?.toUpperCase() || "NA";
  const sellerPart = sellerId.slice(-4).toUpperCase();
  const timePart = Date.now().toString().slice(-5);

  return `SKU-${namePart}-${colorPart}-${sizePart}-${sellerPart}-${timePart}`;
}
