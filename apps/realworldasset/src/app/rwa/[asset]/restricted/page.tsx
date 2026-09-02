import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"provider-required"}];}

export default async function RwaRestrictedLivePage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <LiveRouteWorkspace title="Restricted RWA Provider Required" path={`/rwa/${asset}/restricted`}/>;
}
