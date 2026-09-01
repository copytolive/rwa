import { LiveRouteWorkspace } from "@/components/live-dashboard";
import { ProgramWorkspace, LiveOrdersWorkspace, SellerOrdersWorkspace } from "@/components/program-workspaces";
import { CriticalLiveWorkspace } from "@/components/critical-workspaces/CriticalWorkspaces";
import { MarketsLiveWorkspace } from "@/components/markets-live/MarketsLiveWorkspace";

export const dynamicParams=false;

export function generateStaticParams(){
  const paths=[
    "about","account/activity","account/api","account/billing","api","blog","careers",
    "community","docs","docs/security","help","help/contact","intelligence","listing-request",
    "markets","merchant","merchant/create","merchant/products","merchant/customers","merchant/analytics",
    "merchant/orders","merchant/updates/new","merchant/ads","merchant/tokenization","merchant/rwa","merchant/rewards","merchant/settings",
    "merchant/transactions","merchant/support","merchant/business","merchant/kyb","merchant/rwa/requests",
    "merchant/settings/branding","portfolio/holdings","portfolio/orders","portfolio/transactions",
    "portfolio/allocation","press","privacy","pro","risk-disclosure","settings","settings/security",
    "status","terms","checkout","account/orders","account/orders/refund","rewards/history","rewards/how-it-works",
    "rewards/missions","security","home/products"
  ];
  return paths.map(path=>({slug:path.split("/")}));
}

function titleCase(parts:string[]){return parts.map(part=>part.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())).join(" / ")}

export default async function LiveOnlyRoutePage({params}:{params:Promise<{slug:string[]}>}){
  const {slug}=await params;
  const path=`/${slug.join("/")}`;
  if(path==="/markets")return <MarketsLiveWorkspace/>;
  if(path==="/intelligence")return <ProgramWorkspace kind="intelligence"/>;
  if(path==="/merchant")return <CriticalLiveWorkspace kind="merchant"/>;
  if(path==="/checkout")return <CriticalLiveWorkspace kind="checkout"/>;
  if(path==="/merchant/tokenization")return <ProgramWorkspace kind="tokenization"/>;
  if(path==="/account/api")return <ProgramWorkspace kind="api"/>;
  if(path==="/account/billing")return <ProgramWorkspace kind="billing"/>;
  if(path==="/account/activity")return <ProgramWorkspace kind="activity"/>;
  if(path==="/account/orders")return <LiveOrdersWorkspace/>;
  if(path==="/account/orders/refund")return <LiveOrdersWorkspace dispute/>;
  if(path==="/merchant/orders")return <SellerOrdersWorkspace/>;
  return <LiveRouteWorkspace title={titleCase(slug)} path={path}/>;
}
