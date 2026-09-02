import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"btc-usdc"}];}

export default async function MarketAssetLivePage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <LiveRouteWorkspace title="BTC Market Live Truth" path={`/markets/${asset}`}/>;
}
