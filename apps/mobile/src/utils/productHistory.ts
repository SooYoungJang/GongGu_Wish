export type ProductIdentity = {
  brandName?: string | null;
  productName?: string | null;
};

/**
 * Product names are entered from several sources, so compare their semantic
 * text rather than the original spacing or punctuation.
 */
export function normalizeProductPart(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function isSameProduct(
  left: ProductIdentity,
  right: ProductIdentity,
): boolean {
  const leftProduct = normalizeProductPart(left.productName);
  const rightProduct = normalizeProductPart(right.productName);
  if (!leftProduct || leftProduct !== rightProduct) return false;

  const leftBrand = normalizeProductPart(left.brandName);
  const rightBrand = normalizeProductPart(right.brandName);
  if (!leftBrand || !rightBrand) return true;
  return leftBrand === rightBrand;
}
