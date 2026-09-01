import { LiveRouteWorkspace } from "@/components/live-dashboard";
import { LiveOrdersWorkspace, SellerOrdersWorkspace } from "@/components/program-workspaces";

export const dynamicParams=false;

export function generateStaticParams(){
  const paths=[
    "about","account/activity","account/api","account/billing","api","blog","careers",
    "community","docs","docs/security","help","help/contact","intelligence","listing-request",
    "markets","merchant","merchant/create","merchant/products","merchant/customers","merchant/analytics",
    "merchant/orders","merchant/tokenization","merchant/rwa","merchant/rewards","merchant/settings",
    "merchant/transactions","merchant/support","merchant/business","merchant/kyb","merchant/rwa/requests",
    "merchant/settings/branding","portfolio/holdings","portfolio/orders","portfolio/transactions",
    "portfolio/allocation","press","privacy","pro","risk-disclosure","settings","settings/security",
    "status","terms","checkout","account/orders","rewards/history","rewards/how-it-works",
    "rewards/missions","security","home/products"
  ];
  return paths.map(path=>({slug:path.split("/")}));
}

function titleCase(parts:string[]){return parts.map(part=>part.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())).join(" / ")}

export default async function LiveOnlyRoutePage({params}:{params:Promise<{slug:string[]}>}){
  const {slug}=await params;
  const path=`/${slug.join("/")}`;
  if(path==="/account/orders")return <LiveOrdersWorkspace/>;
  if(path==="/merchant/orders")return <SellerOrdersWorkspace/>;
  return <LiveRouteWorkspace title={titleCase(slug)} path={path}/>;
}
