import { AssetDetail, getCryptoAsset } from "@/components/details";

export default function BtcAssetAliasPage(){
  return <AssetDetail asset={getCryptoAsset("btc-usdc")}/>;
}
