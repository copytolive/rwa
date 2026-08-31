export type DetailVariant = "rwa" | "regulated" | "crypto" | "business-token";

export type BusinessProfileData = {
  slug: string;
  name: string;
  symbol: string;
  tagline: string;
  category: string;
  country: string;
  followers: string;
  rating: string;
  established: string;
  tokenPrice: string;
  tokenChange: string;
  marketCap: string;
  holders: string;
};

export type AssetDetailData = {
  slug: string;
  variant: DetailVariant;
  name: string;
  symbol: string;
  subtitle: string;
  price: string;
  change: string;
  issuer: string;
  country: string;
  assetClass: string;
  tokenStandard: string;
  status: string;
  marketCap: string;
  volume: string;
  supply: string;
  yield?: string;
  aum?: string;
};

export const businessProfiles: Record<string, BusinessProfileData> = {
  "kopi-nusantara": {
    slug: "kopi-nusantara", name: "Kopi Nusantara", symbol: "KOPI",
    tagline: "Indonesia's leading coffee brand connecting farmers, communities, and coffee lovers.",
    category: "Food & Beverage", country: "Indonesia", followers: "12.8K", rating: "4.8 (248 reviews)",
    established: "2018", tokenPrice: "$2.48", tokenChange: "+8.72%", marketCap: "$248.5M", holders: "18,642",
  },
  "seablue-estate": {
    slug: "seablue-estate", name: "Seablue Estate", symbol: "SEA",
    tagline: "Verified property operator connecting premium real estate with transparent digital ownership.",
    category: "Real Estate", country: "Singapore", followers: "8.3K", rating: "4.7 (186 reviews)",
    established: "2019", tokenPrice: "$4.21", tokenChange: "+5.18%", marketCap: "$158.2M", holders: "9,804",
  },
};

export const assetDetails: Record<string, AssetDetailData> = {
  "marina-bay-residences": {
    slug: "marina-bay-residences", variant: "rwa", name: "Marina Bay Residences Token", symbol: "MBR",
    subtitle: "Verified tokenized residential real estate", price: "$1.0234", change: "+1.32%", issuer: "Harbourview Asset Management",
    country: "Singapore", assetClass: "Residential Real Estate", tokenStandard: "ERC-1400", status: "Active",
    marketCap: "$58.72M", volume: "$1.14M", supply: "57.45M MBR", yield: "5.62%", aum: "$58.72M",
  },
  "marina-bay-residences-regulated": {
    slug: "marina-bay-residences-regulated", variant: "regulated", name: "Marina Bay Residences Token", symbol: "MBR",
    subtitle: "Reg D 506(c) security token · regulated RWA", price: "$1.0234", change: "+0.32%", issuer: "Harbourview Asset Management",
    country: "Singapore", assetClass: "Real Estate", tokenStandard: "ERC-1400", status: "MAS Recognized Market Operator",
    marketCap: "$58.72M", volume: "$1.14M", supply: "57.45M MBR", yield: "6.25%", aum: "$58.72M",
  },
  "seaside-private-credit-fund": {
    slug: "seaside-private-credit-fund", variant: "rwa", name: "Seaside Private Credit Fund", symbol: "SSPC",
    subtitle: "Institutional private credit pool", price: "$1.0821", change: "+0.46%", issuer: "Seaside Capital Partners",
    country: "Cayman Islands", assetClass: "Private Credit", tokenStandard: "ERC-3643", status: "Active",
    marketCap: "$986.4M", volume: "$12.8M", supply: "911.5M SSPC", yield: "11.75%", aum: "$986.4M",
  },
  "btc-usdc": {
    slug: "btc-usdc", variant: "crypto", name: "BTC / USDC", symbol: "BTC",
    subtitle: "Bitcoin · Crypto Asset", price: "$66,842.35", change: "+1.82%", issuer: "Bitcoin Network",
    country: "Global", assetClass: "Digital Currency", tokenStandard: "Native", status: "Active",
    marketCap: "$1.32T", volume: "$28.45B", supply: "19.81M BTC",
  },
  "kopi": {
    slug: "kopi", variant: "business-token", name: "KOPI / USDC", symbol: "KOPI",
    subtitle: "Kopi Nusantara Token · Business Utility Token", price: "$2.48", change: "+8.72%", issuer: "Kopi Nusantara",
    country: "Indonesia", assetClass: "Business Utility Token", tokenStandard: "ERC-20", status: "Active",
    marketCap: "$248.5M", volume: "100.24M KOPI", supply: "100.24M KOPI",
  },
};

function humanize(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function getBusinessProfile(slug: string): BusinessProfileData {
  return businessProfiles[slug] ?? {
    ...businessProfiles["kopi-nusantara"], slug, name: humanize(slug), symbol: slug.slice(0, 5).toUpperCase(),
  };
}

export function getRwaAsset(slug: string): AssetDetailData {
  return assetDetails[slug] ?? {
    ...assetDetails["marina-bay-residences"], slug, name: humanize(slug), symbol: slug.slice(0, 4).toUpperCase(),
  };
}

export function getCryptoAsset(slug: string): AssetDetailData {
  return assetDetails[slug] ?? {
    ...assetDetails["btc-usdc"], slug, name: humanize(slug), symbol: slug.split("-")[0]?.toUpperCase() || "BTC",
  };
}

export function getBusinessToken(business: string): AssetDetailData {
  if (business === "kopi-nusantara") return assetDetails.kopi;
  const profile = getBusinessProfile(business);
  return { ...assetDetails.kopi, slug: profile.symbol.toLowerCase(), name: `${profile.symbol} / USDC`, symbol: profile.symbol, issuer: profile.name, country: profile.country };
}
