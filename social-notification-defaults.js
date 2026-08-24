(()=>{
'use strict';
const KEY='rwa_social_pro_v1';
try{
  const raw=localStorage.getItem(KEY);
  if(raw==null){
    localStorage.setItem(KEY,JSON.stringify({
      friends:false,
      top:false,
      trending:false,
      newFollowers:false,
      minFriendUsd:250,
      minTopUsd:2500,
      trendingPct:5,
      consentVersion:'explicit-opt-in-v1'
    }));
  }
}catch{}
window.RWASocialNotificationDefaults={version:'1.0.0',policy:'explicit-opt-in-v1'};
})();
