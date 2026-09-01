import { CriticalLiveWorkspace } from "@/components/critical-workspaces/CriticalWorkspaces";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"btc-usdc"}];}

export default async function TradeAssetPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <CriticalLiveWorkspace kind="trade" asset={asset}/>;
}
