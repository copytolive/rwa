import { AssetDetail, getRwaAsset } from "@/components/details";

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    "marina-bay-residences",
    "marina-bay-residences-regulated",
    "seaside-private-credit-fund",
    "treasury-income-note",
    "gold-reserve-trust",
    "blue-port-logistics-infrastructure",
    "green-energy-fund",
  ].map(asset => ({ asset }));
}

export default async function RwaAssetPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <AssetDetail asset={getRwaAsset(asset)}/>;
}
