import fs from "node:fs";

const commerce = fs.readFileSync("src/components/commerce/Commerce.tsx", "utf8");
const catchAll = fs.readFileSync("src/app/[...slug]/page.tsx", "utf8");
const profile = fs.readFileSync("src/components/details/BusinessProfile.tsx", "utf8");

for (const token of [
  "router.push(\"/checkout\")",
  "router.push(\"/account/orders\")",
  "`/businesses/${businessSlug}/store`",
  "`/businesses/${businessSlug}/store/products/${p.id}`",
  "`/account/orders/${ORDER_ID}/dispute`",
]) {
  if (!commerce.includes(token)) throw new Error(`CHAT09 missing commerce route/action: ${token}`);
}
for (const token of ["StoreScreen", "ProductScreen", "CheckoutScreen", "OrdersScreen", "DisputeScreen", "CommerceRoute"]) {
  if (!commerce.includes(token)) throw new Error(`CHAT09 missing screen/component: ${token}`);
}
if (!catchAll.includes("CommerceRoute")) throw new Error("CHAT09 catch-all is not dispatching real commerce screens");
for (const token of ["checkout","account/orders","/store/products/"]) {
  if (!catchAll.includes(token)) throw new Error(`CHAT09 static route coverage missing: ${token}`);
}
if (!profile.includes("/store") || !profile.includes("Visit Store")) throw new Error("CHAT09 BusinessProfile store handoff missing");

const buttonCount = (commerce.match(/<button\b/g) || []).length;
const actionCount = (commerce.match(/onClick=/g) || []).length;
if (buttonCount === 0 || actionCount < buttonCount) {
  throw new Error(`CHAT09 native control contract failed: ${buttonCount} buttons, ${actionCount} onClick actions`);
}
console.log(`CHAT09 commerce PASS: Store -> Product -> Checkout -> Orders -> Dispute routes connected; ${buttonCount} native button controls have actions.`);
