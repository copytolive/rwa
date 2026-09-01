import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{id:"provider-required"}];}

export default async function PositionProviderRequiredPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return <LiveRouteWorkspace title="Position Provider Required" path={`/positions/${id}`}/>;
}
