import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"btc-usdc"}];}

export default async function TradeAssetLivePage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <LiveRouteWorkspace title="BTC Trade Live Truth" path={`/trade/${asset}`}/>;
}
