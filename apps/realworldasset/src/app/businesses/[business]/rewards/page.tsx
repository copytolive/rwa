import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams=false;
export function generateStaticParams(){return [{business:"provider-required"}];}

export default async function BusinessRewardsLivePage({params}:{params:Promise<{business:string}>}){
  const {business}=await params;
  return <LiveRouteWorkspace title="Business Rewards Provider Required" path={`/businesses/${business}/rewards`}/>;
}
