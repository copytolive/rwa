import { RoutePlaceholder } from "@/components/public";
import { CommerceRoute } from "@/components/commerce";
import { CommunityRoute } from "@/components/community";
import { SettingsSupportRoute } from "@/components/settings-support";
import { MerchantRoute } from "@/components/merchant";
import { MerchantGrowthRoute } from "@/components/merchant-growth";
import { LiveOrdersWorkspace, ProgramWorkspace, SellerOrdersWorkspace } from "@/components/program-workspaces";

export const dynamicParams = false;

export function generateStaticParams() {
  const fixed = [
    "about","account/activity","account/api","account/billing","api","blog","careers",
    "community","community/compose","bookmarks","community/thesis/alex-kopi-buy","community/thesis/kopi-bali-update",
    "community/thesis/kopi-long-term-value","community/thesis/ssea-hidden-gem","community/thesis/marina-prime",
    "community/users/alex-morgan","community/users/alex-yield","docs","docs/security",
    "help","help/contact","intelligence","listing-request","markets","merchant","merchant/create","merchant/products","merchant/customers","merchant/analytics","merchant/orders","merchant/updates/new","merchant/ads","merchant/tokenization","portfolio/holdings",
    "portfolio/orders","portfolio/transactions","portfolio/allocation","press","privacy","pro",
    "risk-disclosure","settings","settings/security","status","terms","rwa/kopi/alerts",
    "positions/POS-KOPI-001/risk","rwa/kopi/activity","rwa/kopi/documents","checkout","account/orders",
    "account/orders/RWA-ORD-20240516-9F7A2B/dispute",
    "rewards/history","rewards/how-it-works","rewards/missions","security","home/products",
    "merchant/rwa","merchant/rewards","merchant/settings","merchant/transactions","merchant/support","merchant/business","merchant/kyb","merchant/rwa/requests","merchant/settings/branding",
    "community/users/andreas-wijaya","community/users/jessica-santoso","community/users/michael-tanuwijaya",
    ...[1,2,3].map(i => `intelligence/btc-${i}`),
    ...[1,2,3].map(i => `intelligence/research-${i}`),
    ...[1,2,3,4].map(i => `community/thesis/btc-${i}`),
    ...[1,2,3].map(i => `community/thesis/kopi-${i}`),
  ];
  const businesses = ["kopi-nusantara","seablue-estate","harbourview-asset-management","blue-ocean-shipping","maple-finance","green-city-living","seaside-villas"];
  const businessRoutes = businesses.flatMap(b => [
    `businesses/${b}/store`,`businesses/${b}/updates`,
    `businesses/${b}/transparency`,`businesses/${b}/about`,`businesses/${b}/store/locations`,
    `businesses/${b}/contact`,`businesses/${b}/token/activity`,`businesses/${b}/token/disclosures`,
    `businesses/${b}/token/tokenomics`,`businesses/${b}/token/utility`,`businesses/${b}/token/vesting`,
    ...[1,2,3,4,5,6,7,8].map(i => `businesses/${b}/store/products/${i}`),
    ...[1,2,3].map(i => `businesses/${b}/updates/${i}`),
  ]);
  const rwaAssets = ["marina-bay-residences","marina-bay-residences-regulated","seaside-private-credit-fund","treasury-income-note","gold-reserve-trust","blue-port-logistics-infrastructure","green-energy-fund"];
  const rwaRoutes = rwaAssets.flatMap(a => [
    ...["activity","underlying-asset","underlying","documents","cashflows","legal","valuation","terms","disclosures","restricted"].map(x => `rwa/${a}/${x}`),
    ...[1,2,3,4,5].map(i => `rwa/${a}/documents/${i}`),
  ]);
  const marketRoutes = [
    "markets/btc-usdc/activity","markets/btc-usdc/order-book","markets/btc-usdc/disclosures",
    ...["market-cap","fully-diluted-valuation","circulating-supply","max-supply","24h-volume","liquidity","24h-high","24h-low","all-time-high","all-time-low"].map(x => `markets/btc-usdc/metrics/${x}`),
  ];
  return [...new Set([...fixed,...businessRoutes,...rwaRoutes,...marketRoutes])].map(path => ({ slug: path.split("/") }));
}

function titleCase(parts:string[]){return parts.map(part=>part.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())).join(" / ")}
export default async function PlaceholderPage({params}:{params:Promise<{slug:string[]}>}){
  const {slug}=await params; const path=`/${slug.join("/")}`;
  if(path==="/markets")return <ProgramWorkspace kind="markets"/>;
  if(path==="/intelligence")return <ProgramWorkspace kind="intelligence"/>;
  if(path==="/merchant/tokenization")return <ProgramWorkspace kind="tokenization"/>;
  if(path==="/account/api")return <ProgramWorkspace kind="api"/>;
  if(path==="/account/billing")return <ProgramWorkspace kind="billing"/>;
  if(path==="/account/activity")return <ProgramWorkspace kind="activity"/>;
  if(path==="/account/orders")return <LiveOrdersWorkspace/>;
  if(path.includes("/account/orders/")&&path.endsWith("/dispute"))return <LiveOrdersWorkspace dispute/>;
  if(path==="/merchant/orders")return <SellerOrdersWorkspace/>;
  if(["/merchant/updates/new","/merchant/ads"].includes(path))return <MerchantGrowthRoute path={path}/>;
  if(path==="/merchant"||["/merchant/create","/merchant/products","/merchant/customers","/merchant/analytics"].includes(path))return <MerchantRoute path={path}/>;
  if(["/settings","/settings/security","/pro","/help","/status"].includes(path))return <SettingsSupportRoute path={path}/>;
  if(path==="/community"||path==="/community/compose"||path==="/bookmarks"||path.startsWith("/community/users/")||path.startsWith("/community/thesis/"))return <CommunityRoute path={path}/>;
  if(path==="/checkout"||path.match(/^\/businesses\/[^/]+\/store(?:\/products\/[^/]+)?$/))return <CommerceRoute path={path}/>;
  return <RoutePlaceholder title={titleCase(slug)} path={path}/>;
}
