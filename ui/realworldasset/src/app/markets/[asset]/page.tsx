import { AssetDetail, getCryptoAsset } from "@/components/details";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ asset: "btc-usdc" }, { asset: "kopi" }];
}

export default async function CryptoAssetPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <AssetDetail asset={getCryptoAsset(asset)}/>;
}
