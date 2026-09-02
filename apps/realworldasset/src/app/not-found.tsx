import Link from "next/link";
import { PublicShell } from "@/components/public";

export default function NotFound(){
  return <PublicShell>
    <main style={{minHeight:"calc(100vh - 120px)",display:"grid",placeItems:"center",padding:"32px",background:"#030812",color:"#edf4ff"}}>
      <section style={{width:"min(760px,100%)",padding:"28px",border:"1px solid #173052",borderRadius:"16px",background:"#07111f"}}>
        <small style={{color:"#6ea7ff",letterSpacing:".12em",fontWeight:700}}>RWA.MS / ROUTE STATUS</small>
        <h1 style={{fontSize:"34px",margin:"10px 0"}}>Page not found</h1>
        <p style={{color:"#9cb0ca",lineHeight:1.6}}>This route is not published in the current production application. Use the live navigation below to continue.</p>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginTop:"20px"}}>
          <Link href="/" className="rwa-link-button rwa-link-button--primary">Open Home</Link>
          <Link href="/markets" className="rwa-link-button">Open Markets</Link>
          <Link href="/status" className="rwa-link-button">System Status</Link>
        </div>
      </section>
    </main>
  </PublicShell>;
}
