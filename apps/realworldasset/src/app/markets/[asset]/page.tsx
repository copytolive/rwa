import { AssetDetail, getCryptoAsset, getRwaAsset } from "@/components/details";

export const dynamicParams = false;
const rwaAssets = new Set([
  "marina-bay-residences",
  "marina-bay-residences-regulated",
  "seaside-private-credit-fund",
  "treasury-income-note",
  "gold-reserve-trust",
  "blue-port-logistics-infrastructure",
  "green-energy-fund",
]);

export function generateStaticParams() {
  return ["btc-usdc", "kopi", ...rwaAssets].map(asset => ({ asset }));
}

export default async function MarketAssetPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <AssetDetail asset={rwaAssets.has(asset) ? getRwaAsset(asset) : getCryptoAsset(asset)}/>;
}
