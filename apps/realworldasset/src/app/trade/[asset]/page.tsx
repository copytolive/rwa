import { TradeLiveWorkspace } from "@/components/trade-live/TradeLiveWorkspace";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"btc-usdc"}];}

export default async function TradeAssetPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <TradeLiveWorkspace asset={asset}/>;
}
