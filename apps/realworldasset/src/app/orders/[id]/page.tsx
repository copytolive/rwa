import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{id:"provider-required"}];}

export default async function OrderProviderRequiredPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return <LiveRouteWorkspace title="Order Provider Required" path={`/orders/${id}`}/>;
}
