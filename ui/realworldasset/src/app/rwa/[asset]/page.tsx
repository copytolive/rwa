import { AssetDetail, getRwaAsset } from "@/components/details";

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    { asset: "marina-bay-residences" },
    { asset: "marina-bay-residences-regulated" },
    { asset: "seaside-private-credit-fund" },
  ];
}

export default async function RwaAssetPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <AssetDetail asset={getRwaAsset(asset)}/>;
}
