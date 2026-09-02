import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"provider-required"}];}

export default async function RwaAssetLivePage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <LiveRouteWorkspace title="RWA Provider Required" path={`/rwa/${asset}`}/>;
}
