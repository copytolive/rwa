import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{asset:"provider-required"}];}

export default async function RwaDisclosuresLivePage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <LiveRouteWorkspace title="RWA Disclosures Provider Required" path={`/rwa/${asset}/disclosures`}/>;
}
