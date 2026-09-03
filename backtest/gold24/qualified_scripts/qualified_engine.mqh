#ifndef GOLD24_QUALIFIED_ENGINE_MQH
#define GOLD24_QUALIFIED_ENGINE_MQH

#property strict
#include <Trade/Trade.mqh>
CTrade trade;

#ifndef QM_FAMILY_CODE
#error QM_FAMILY_CODE must be defined by wrapper
#endif
#ifndef QM_FAST
#error QM_FAST must be defined by wrapper
#endif
#ifndef QM_SLOW
#error QM_SLOW must be defined by wrapper
#endif
#ifndef QM_P1
#define QM_P1 0.0
#endif
#ifndef QM_P2
#define QM_P2 0.0
#endif
#ifndef QM_P3
#define QM_P3 0.0
#endif
#ifndef QM_SL_USD
#error QM_SL_USD must be defined by wrapper
#endif
#ifndef QM_TP_USD
#error QM_TP_USD must be defined by wrapper
#endif
#ifndef QM_OFFSET_USD
#error QM_OFFSET_USD must be defined by wrapper
#endif
#ifndef QM_EXPIRY_BARS
#error QM_EXPIRY_BARS must be defined by wrapper
#endif
#ifndef QM_DIRECTION_MODE
#error QM_DIRECTION_MODE must be defined by wrapper
#endif
#ifndef QM_ENTRY_METHOD
#error QM_ENTRY_METHOD must be defined by wrapper
#endif
#ifndef QM_CONFIG_HASH
#error QM_CONFIG_HASH must be defined by wrapper
#endif
#ifndef QM_MAGIC
#error QM_MAGIC must be defined by wrapper
#endif
#ifndef QM_TAG
#define QM_TAG "GOLD24_QUALIFIED"
#endif

input string InpSignalSymbol = "XAUUSD";
input string InpTradeSymbol  = "XAUUSD";
input double InpLot          = 1.0;
input ulong  InpMagic        = QM_MAGIC;
input bool   InpParityMode   = false;
input bool   InpAllowGapMarketFill = true;
input int    InpDeviationPoints = 50;

const datetime CANONICAL_START = D'2000.10.23 00:00';
const int FAST=QM_FAST;
const int SLOW=QM_SLOW;
const double P1=QM_P1;
const double P2=QM_P2;
const double P3=QM_P3;
const double SL_USD=QM_SL_USD;
const double TP_USD=QM_TP_USD;
const double OFFSET_USD=QM_OFFSET_USD;
const int EXPIRY_BARS=QM_EXPIRY_BARS;
const string DIRECTION_MODE=QM_DIRECTION_MODE;
const string ENTRY_METHOD=QM_ENTRY_METHOD;
const string CONFIG_HASH=QM_CONFIG_HASH;

datetime g_lastBar=0;
string gSignalSymbol="";
string gTradeSymbol="";
double gLot=0.0;
bool gParity=false;
long gBarsSeen=0;
long gSignals=0;
long gOrderAttempts=0;
long gOrderAccepted=0;
long gTradeErrors=0;
long gGapMarketFills=0;
string gTradeErrorDetails="";

void AppendTradeError(const string action,const uint rc,const string desc,const int err)
{
   if(StringLen(gTradeErrorDetails)>7000) return;
   string clean=desc;
   StringReplace(clean,"\r"," ");
   StringReplace(clean,"\n"," ");
   gTradeErrorDetails+=StringFormat("%s:%u:%s:%d|",action,rc,clean,err);
}

string ReceiptPath(){ return StringFormat("Gold24Qualified\\receipt_%I64u.txt",InpMagic); }

void WriteReceipt(const string status,const int reason)
{
   int h=FileOpen(ReceiptPath(),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return;
   FileWriteString(h,StringFormat(
      "status=%s\nmagic=%I64u\nconfig_hash=%s\nentry_method=%s\nsignal_symbol=%s\ntrade_symbol=%s\nparity_mode=%s\nbars=%I64d\nsignals=%I64d\norder_attempts=%I64d\norder_accepted=%I64d\ntrade_errors=%I64d\ngap_market_fills=%I64d\ntrade_error_details=%s\ndeinit_reason=%d\n",
      status,InpMagic,CONFIG_HASH,ENTRY_METHOD,gSignalSymbol,gTradeSymbol,gParity?"true":"false",gBarsSeen,gSignals,gOrderAttempts,gOrderAccepted,gTradeErrors,gGapMarketFills,gTradeErrorDetails,reason));
   FileClose(h);
}

bool RetcodeAccepted(const uint rc)
{
   return rc==TRADE_RETCODE_DONE || rc==TRADE_RETCODE_PLACED || rc==TRADE_RETCODE_DONE_PARTIAL || rc==TRADE_RETCODE_NO_CHANGES;
}

bool RecordTradeResult(const bool ok,const string action)
{
   gOrderAttempts++;
   uint rc=trade.ResultRetcode();
   bool accepted=ok && RetcodeAccepted(rc);
   if(accepted){ gOrderAccepted++; return true; }
   gTradeErrors++;
   int err=GetLastError();
   string desc=trade.ResultRetcodeDescription();
   AppendTradeError(action,rc,desc,err);
   PrintFormat("GOLD24_TRADE_FAIL action=%s ok=%s retcode=%u desc=%s last_error=%d",action,ok?"true":"false",rc,desc,err);
   return false;
}

double NormalizeVolumeForSymbol(const string sym,const double requested)
{
   double vmin=SymbolInfoDouble(sym,SYMBOL_VOLUME_MIN);
   double vmax=SymbolInfoDouble(sym,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(sym,SYMBOL_VOLUME_STEP);
   if(vmin<=0.0) vmin=0.01;
   if(vmax<=0.0) vmax=MathMax(vmin,requested);
   if(step<=0.0) step=vmin;
   double v=MathMax(vmin,MathMin(vmax,requested));
   v=vmin+MathRound((v-vmin)/step)*step;
   int digits=0; double s=step;
   while(digits<8 && MathAbs(s-MathRound(s))>1e-10){s*=10.0;digits++;}
   return NormalizeDouble(v,digits);
}

bool EnsureSymbolReady(const string sym)
{
   if(sym=="") return false;
   ResetLastError();
   if(!SymbolSelect(sym,true)){
      PrintFormat("GOLD24_INIT_FAIL SymbolSelect(%s) err=%d",sym,GetLastError());
      return false;
   }
   return true;
}

bool NewSignalBar()
{
   datetime t=iTime(gSignalSymbol,PERIOD_D1,0);
   if(t==0 || t==g_lastBar) return false;
   g_lastBar=t;
   gBarsSeen++;
   return true;
}

bool HasOurPosition()
{
   if(!PositionSelect(gTradeSymbol)) return false;
   return ((ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic);
}

ulong OurPendingTicket()
{
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      ulong ticket=OrderGetTicket(i);
      if(ticket==0) continue;
      if(OrderGetString(ORDER_SYMBOL)!=gTradeSymbol) continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC)!=InpMagic) continue;
      ENUM_ORDER_TYPE type=(ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      if(type==ORDER_TYPE_BUY_LIMIT || type==ORDER_TYPE_SELL_LIMIT || type==ORDER_TYPE_BUY_STOP || type==ORDER_TYPE_SELL_STOP) return ticket;
   }
   return 0;
}

void CancelExpiredPending()
{
   ulong ticket=OurPendingTicket();
   if(ticket==0) return;
   datetime setup=(datetime)OrderGetInteger(ORDER_TIME_SETUP);
   int bars=iBarShift(gSignalSymbol,PERIOD_D1,setup,false);
   if(bars>=EXPIRY_BARS)
   {
      ResetLastError();
      bool ok=trade.OrderDelete(ticket);
      uint rc=trade.ResultRetcode();
      if(!(ok && RetcodeAccepted(rc)))
      {
         gTradeErrors++;
         int err=GetLastError();
         string desc=trade.ResultRetcodeDescription();
         AppendTradeError("DELETE",rc,desc,err);
         PrintFormat("GOLD24_DELETE_FAIL ticket=%I64u retcode=%u desc=%s err=%d",ticket,rc,desc,err);
      }
   }
}

bool LoadCanonicalRates(MqlRates &r[])
{
   datetime end=iTime(gSignalSymbol,PERIOD_D1,1);
   if(end==0) return false;
   ArrayFree(r);
   ResetLastError();
   int copied=CopyRates(gSignalSymbol,PERIOD_D1,CANONICAL_START,end,r);
   if(copied<=0) PrintFormat("GOLD24_COPYRATES_FAIL symbol=%s err=%d",gSignalSymbol,GetLastError());
   return copied>0;
}

double PandasEMAAt(MqlRates &r[],int period,int endIdx)
{
   int n=ArraySize(r);
   if(n<=0 || endIdx<0) return EMPTY_VALUE;
   if(endIdx>=n) endIdx=n-1;
   double alpha=2.0/(period+1.0), ema=r[0].close;
   for(int i=1;i<=endIdx;i++) ema=alpha*r[i].close+(1.0-alpha)*ema;
   return ema;
}

double PandasEMA(MqlRates &r[],int period)
{
   return PandasEMAAt(r,period,ArraySize(r)-1);
}

double RollingLinRegSlopeAt(MqlRates &r[],int period,int endIdx)
{
   period=MathMax(2,period);
   if(endIdx-period+1<0) return 0.0;
   double meanX=(period-1)*0.5;
   double den=0.0,num=0.0;
   int start=endIdx-period+1;
   for(int j=0;j<period;j++)
   {
      double w=j-meanX;
      den+=w*w;
      num+=w*r[start+j].close;
   }
   if(den<=0.0) return 0.0;
   return num/den;
}

double SimpleRollingRSI(MqlRates &r[],int period)
{
   int n=ArraySize(r); if(n<period+1) return 50.0;
   double gain=0.0,loss=0.0;
   for(int i=n-period;i<n;i++)
   {
      double d=r[i].close-r[i-1].close;
      if(d>0.0) gain+=d; else if(d<0.0) loss+=(-d);
   }
   gain/=period; loss/=period;
   if(loss==0.0) return 50.0;
   double rs=gain/loss;
   return 100.0-100.0/(1.0+rs);
}

double TrueRangeAt(MqlRates &r[],int idx)
{
   if(idx<=0) return r[idx].high-r[idx].low;
   double a=r[idx].high-r[idx].low;
   double b=MathAbs(r[idx].high-r[idx-1].close);
   double c=MathAbs(r[idx].low-r[idx-1].close);
   return MathMax(a,MathMax(b,c));
}

double RollingATRAt(MqlRates &r[],int period,int endIdx)
{
   if(period<=0 || endIdx-period+1<1) return EMPTY_VALUE;
   double sum=0.0;
   for(int i=endIdx-period+1;i<=endIdx;i++) sum+=TrueRangeAt(r,i);
   return sum/period;
}

void PriorRange(MqlRates &r[],int lookback,int signalIdx,double &rh,double &rl)
{
   rh=-DBL_MAX; rl=DBL_MAX;
   int start=signalIdx-lookback;
   int end=signalIdx-1;
   if(start<0) start=0;
   for(int i=start;i<=end;i++)
   {
      if(r[i].high>rh) rh=r[i].high;
      if(r[i].low<rl) rl=r[i].low;
   }
}

double RollingCloseMeanAt(MqlRates &r[],int period,int endIdx)
{
   if(period<=0 || endIdx-period+1<0) return EMPTY_VALUE;
   double sum=0.0;
   for(int i=endIdx-period+1;i<=endIdx;i++) sum+=r[i].close;
   return sum/period;
}

double RollingCloseStdPopulationAt(MqlRates &r[],int period,int endIdx)
{
   double mean=RollingCloseMeanAt(r,period,endIdx);
   if(mean==EMPTY_VALUE) return EMPTY_VALUE;
   double ss=0.0;
   for(int i=endIdx-period+1;i<=endIdx;i++)
   {
      double d=r[i].close-mean;
      ss+=d*d;
   }
   return MathSqrt(ss/period);
}

double RollingVolumeMeanAt(MqlRates &r[],int period,int endIdx)
{
   if(period<=0 || endIdx-period+1<0) return EMPTY_VALUE;
   double sum=0.0;
   for(int i=endIdx-period+1;i<=endIdx;i++)
   {
      double v=(r[i].real_volume>0 ? (double)r[i].real_volume : (double)r[i].tick_volume);
      sum+=v;
   }
   return sum/period;
}

bool PandasKAMALastTwo(MqlRates &r[],int period,double &prevKama,double &curKama)
{
   int n=ArraySize(r);
   if(n<2 || period<=0) return false;
   double fastSC=2.0/3.0;
   double slowSC=2.0/31.0;
   double kama=r[0].close;
   prevKama=kama;
   for(int i=1;i<n;i++)
   {
      double er=0.0;
      if(i>=period)
      {
         double change=MathAbs(r[i].close-r[i-period].close);
         double volatility=0.0;
         for(int j=i-period+1;j<=i;j++)
            volatility+=MathAbs(r[j].close-r[j-1].close);
         if(volatility>0.0) er=change/volatility;
         if(er<0.0) er=0.0;
         if(er>1.0) er=1.0;
      }
      double sc=er*(fastSC-slowSC)+slowSC;
      sc*=sc;
      double next=kama+sc*(r[i].close-kama);
      if(i==n-1) prevKama=kama;
      kama=next;
   }
   curKama=kama;
   return true;
}

int CanonicalSignal()
{
   MqlRates r[]; if(!LoadCanonicalRates(r)) return 0;
   int n=ArraySize(r),warmup=MathMax(150,SLOW+2);
   if(n<=warmup) return 0;
   bool longSig=false,shortSig=false;

   // MetaEditor/MQL5 does not support C-style #if expressions. QM_FAMILY_CODE is
   // a wrapper-defined numeric macro, so branch on it as a normal constant expression.
   if(QM_FAMILY_CODE==1)
   {
      if(n<SLOW+1) return 0;
      double rsi=SimpleRollingRSI(r,FAST);
      double rh=-DBL_MAX,rl=DBL_MAX;
      for(int i=n-2;i>=n-SLOW-1;i--){if(r[i].high>rh)rh=r[i].high;if(r[i].low<rl)rl=r[i].low;}
      double closeNow=r[n-1].close;
      longSig=(closeNow>rh && rsi>50.0);
      shortSig=(closeNow<rl && rsi<50.0);
   }
   else if(QM_FAMILY_CODE==2)
   {
      if(n<3) return 0;
      MqlRates cur=r[n-1],prev=r[n-2];
      bool bull=(cur.close>cur.open && prev.close<prev.open && cur.close>=prev.open && cur.open<=prev.close);
      bool bear=(cur.close<cur.open && prev.close>prev.open && cur.close<=prev.open && cur.open>=prev.close);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(bull && emaFast>emaSlow);
      shortSig=(bear && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==3)
   {
      // Python CHART_PATTERN parity.
      if(n<=MathMax(SLOW+2,FAST+2)) return 0;
      int curIdx=n-1,prevIdx=n-2;
      double curRh,curRl,prevRh,prevRl;
      PriorRange(r,SLOW,curIdx,curRh,curRl);
      PriorRange(r,SLOW,prevIdx,prevRh,prevRl);
      double atrCur=RollingATRAt(r,FAST,curIdx);
      double atrPrev=RollingATRAt(r,FAST,prevIdx);
      if(atrCur==EMPTY_VALUE || atrPrev==EMPTY_VALUE) return 0;
      double tolCur=MathMax(atrCur*P1,1e-9);
      double tolPrev=MathMax(atrPrev*P1,1e-9);
      bool nearSupport=(MathAbs(r[curIdx].low-curRl)<=tolCur);
      bool nearResistance=(MathAbs(r[curIdx].high-curRh)<=tolCur);
      bool priorSupportTouch=(MathAbs(r[prevIdx].low-prevRl)<=tolPrev);
      bool priorResistanceTouch=(MathAbs(r[prevIdx].high-prevRh)<=tolPrev);
      double emaFast=PandasEMA(r,FAST);
      longSig=(nearSupport && priorSupportTouch && r[curIdx].close>r[curIdx].open && r[curIdx].close>emaFast);
      shortSig=(nearResistance && priorResistanceTouch && r[curIdx].close<r[curIdx].open && r[curIdx].close<emaFast);
   }
   else if(QM_FAMILY_CODE==4)
   {
      // Python ADAPTIVE_TREND parity: Kaufman adaptive MA + FAST ATR band.
      if(n<=FAST+2) return 0;
      double prevKama=0.0,curKama=0.0;
      if(!PandasKAMALastTwo(r,FAST,prevKama,curKama)) return 0;
      double atrCur=RollingATRAt(r,FAST,n-1);
      if(atrCur==EMPTY_VALUE) return 0;
      double slope=curKama-prevKama;
      double band=P1*atrCur;
      double closeNow=r[n-1].close;
      longSig=(closeNow>curKama+band && slope>0.0);
      shortSig=(closeNow<curKama-band && slope<0.0);
   }
   else if(QM_FAMILY_CODE==5)
   {
      // Python BOLLINGER_REVERSION_V2 parity:
      // rolling SMA/std(ddof=0), previous-bar band excursion, current re-entry,
      // and simple rolling RSI(FAST). Warmup already removes bfill-only region.
      if(n<=MathMax(SLOW+2,FAST+2)) return 0;
      int curIdx=n-1,prevIdx=n-2;
      double smaCur=RollingCloseMeanAt(r,SLOW,curIdx);
      double stdCur=RollingCloseStdPopulationAt(r,SLOW,curIdx);
      double smaPrev=RollingCloseMeanAt(r,SLOW,prevIdx);
      double stdPrev=RollingCloseStdPopulationAt(r,SLOW,prevIdx);
      if(smaCur==EMPTY_VALUE || stdCur==EMPTY_VALUE || smaPrev==EMPTY_VALUE || stdPrev==EMPTY_VALUE) return 0;
      double upperCur=smaCur+P1*stdCur;
      double lowerCur=smaCur-P1*stdCur;
      double upperPrev=smaPrev+P1*stdPrev;
      double lowerPrev=smaPrev-P1*stdPrev;
      double rsi=SimpleRollingRSI(r,FAST);
      longSig=(r[prevIdx].close<lowerPrev && r[curIdx].close>lowerCur && rsi<P2);
      shortSig=(r[prevIdx].close>upperPrev && r[curIdx].close<upperCur && rsi>100.0-P2);
   }
   else if(QM_FAMILY_CODE==6)
   {
      // Python VOLUME parity: rolling SLOW volume mean, FAST prior high/low,
      // and pandas-style EMA FAST/SLOW trend confirmation.
      if(n<=MathMax(SLOW+2,FAST+2)) return 0;
      int curIdx=n-1;
      double volMean=RollingVolumeMeanAt(r,SLOW,curIdx);
      if(volMean==EMPTY_VALUE || volMean<=0.0) return 0;
      double curVol=(r[curIdx].real_volume>0 ? (double)r[curIdx].real_volume : (double)r[curIdx].tick_volume);
      bool spike=(curVol>=volMean*P1);
      double rh,rl;
      PriorRange(r,FAST,curIdx,rh,rl);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(spike && r[curIdx].close>rh && emaFast>emaSlow);
      shortSig=(spike && r[curIdx].close<rl && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==7)
   {
      // Python VOLATILITY_REGIME parity:
      // ATR(FAST)/ATR(SLOW) regime split, FAST prior high/low, EMA trend,
      // and SLOW rolling z-score with simple rolling RSI(FAST).
      if(n<=MathMax(SLOW+2,FAST+2)) return 0;
      int curIdx=n-1;
      double atrFast=RollingATRAt(r,FAST,curIdx);
      double atrSlow=RollingATRAt(r,SLOW,curIdx);
      double sma=RollingCloseMeanAt(r,SLOW,curIdx);
      double std=RollingCloseStdPopulationAt(r,SLOW,curIdx);
      if(atrFast==EMPTY_VALUE || atrSlow==EMPTY_VALUE || atrSlow<=0.0 || sma==EMPTY_VALUE || std==EMPTY_VALUE) return 0;
      double ratio=atrFast/MathMax(atrSlow,1e-9);
      double z=(r[curIdx].close-sma)/MathMax(std,1e-9);
      double rh,rl; PriorRange(r,FAST,curIdx,rh,rl);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      double rsi=SimpleRollingRSI(r,FAST);
      bool trendLong=(ratio>=P1 && r[curIdx].close>rh && emaFast>emaSlow);
      bool trendShort=(ratio>=P1 && r[curIdx].close<rl && emaFast<emaSlow);
      bool revertLong=(ratio<=P2 && z<-1.0 && rsi<40.0);
      bool revertShort=(ratio<=P2 && z>1.0 && rsi>60.0);
      longSig=(trendLong || revertLong);
      shortSig=(trendShort || revertShort);
   }
   else if(QM_FAMILY_CODE==10)
   {
      // Python ATR_BREAKOUT parity.
      int curIdx=n-1;
      double sma=RollingCloseMeanAt(r,SLOW,curIdx);
      double atrCur=RollingATRAt(r,FAST,curIdx);
      if(sma==EMPTY_VALUE || atrCur==EMPTY_VALUE) return 0;
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      double closeNow=r[curIdx].close;
      longSig=(closeNow>sma+P1*atrCur && emaFast>emaSlow);
      shortSig=(closeNow<sma-P1*atrCur && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==13)
   {
      // Python PRICE_STRUCTURE parity: SLOW prior range plus EMA trend.
      int curIdx=n-1;
      double rh,rl; PriorRange(r,SLOW,curIdx,rh,rl);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(r[curIdx].close>rh && emaFast>emaSlow);
      shortSig=(r[curIdx].close<rl && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==16)
   {
      // Python MARKET_STRUCTURE parity using current and previous FAST prior ranges.
      int curIdx=n-1,prevIdx=n-2;
      if(prevIdx<=FAST) return 0;
      double rhCur,rlCur,rhPrev,rlPrev;
      PriorRange(r,FAST,curIdx,rhCur,rlCur);
      PriorRange(r,FAST,prevIdx,rhPrev,rlPrev);
      bool higherLow=(rlCur>rlPrev);
      bool lowerHigh=(rhCur<rhPrev);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(r[curIdx].close>rhCur && higherLow && emaFast>emaSlow);
      shortSig=(r[curIdx].close<rlCur && lowerHigh && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==17)
   {
      // Python SUPPORT_RESISTANCE parity.
      int curIdx=n-1;
      double rh,rl; PriorRange(r,SLOW,curIdx,rh,rl);
      double atrCur=RollingATRAt(r,FAST,curIdx);
      if(atrCur==EMPTY_VALUE) return 0;
      double tol=MathMax(atrCur*P1,1e-9);
      double rsi=SimpleRollingRSI(r,FAST);
      longSig=(r[curIdx].low<=rl+tol && r[curIdx].close>rl && r[curIdx].close>r[curIdx].open && rsi>50.0);
      shortSig=(r[curIdx].high>=rh-tol && r[curIdx].close<rh && r[curIdx].close<r[curIdx].open && rsi<50.0);
   }
   else if(QM_FAMILY_CODE==19)
   {
      // Python VOLATILITY parity.
      int curIdx=n-1;
      double atrFast=RollingATRAt(r,FAST,curIdx);
      double atrSlow=RollingATRAt(r,SLOW,curIdx);
      if(atrFast==EMPTY_VALUE || atrSlow==EMPTY_VALUE || atrSlow<=0.0) return 0;
      double ratio=atrFast/MathMax(atrSlow,1e-9);
      double rh,rl; PriorRange(r,FAST,curIdx,rh,rl);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(ratio>=P1 && r[curIdx].close>rh && emaFast>emaSlow);
      shortSig=(ratio>=P1 && r[curIdx].close<rl && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==34)
   {
      // Python BOLLINGER_SQUEEZE parity including previous-bar squeeze state.
      int curIdx=n-1,prevIdx=n-2;
      double smaCur=RollingCloseMeanAt(r,SLOW,curIdx);
      double stdCur=RollingCloseStdPopulationAt(r,SLOW,curIdx);
      double smaPrev=RollingCloseMeanAt(r,SLOW,prevIdx);
      double stdPrev=RollingCloseStdPopulationAt(r,SLOW,prevIdx);
      if(smaCur==EMPTY_VALUE || stdCur==EMPTY_VALUE || smaPrev==EMPTY_VALUE || stdPrev==EMPTY_VALUE) return 0;
      double upperCur=smaCur+P2*stdCur;
      double lowerCur=smaCur-P2*stdCur;
      double upperPrev=smaPrev+P2*stdPrev;
      double lowerPrev=smaPrev-P2*stdPrev;
      double prevBandwidth=(upperPrev-lowerPrev)/MathMax(MathAbs(smaPrev),1e-9);
      bool prevSqueeze=(prevBandwidth<=P1);
      double rh,rl; PriorRange(r,FAST,curIdx,rh,rl);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(prevSqueeze && r[curIdx].close>rh && emaFast>emaSlow);
      shortSig=(prevSqueeze && r[curIdx].close<rl && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==35)
   {
      // Python KELTNER_SQUEEZE parity including previous-bar compression state.
      int curIdx=n-1,prevIdx=n-2;
      double atrFastCur=RollingATRAt(r,FAST,curIdx);
      double atrFastPrev=RollingATRAt(r,FAST,prevIdx);
      double atrSlowPrev=RollingATRAt(r,SLOW,prevIdx);
      if(atrFastCur==EMPTY_VALUE || atrFastPrev==EMPTY_VALUE || atrSlowPrev==EMPTY_VALUE || atrSlowPrev<=0.0) return 0;
      bool prevCompressed=(atrFastPrev/MathMax(atrSlowPrev,1e-9)<=P1);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      double upper=emaFast+P2*atrFastCur;
      double lower=emaFast-P2*atrFastCur;
      longSig=(prevCompressed && r[curIdx].close>upper && emaFast>emaSlow);
      shortSig=(prevCompressed && r[curIdx].close<lower && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==39)
   {
      // Python FIB_PULLBACK parity.
      int curIdx=n-1;
      double rh,rl; PriorRange(r,SLOW,curIdx,rh,rl);
      double span=MathMax(rh-rl,1e-9);
      double longLevel=rh-P1*span;
      double shortLevel=rl+P1*span;
      double tol=MathMax((P2/100.0)*span,1e-9);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(emaFast>emaSlow && MathAbs(r[curIdx].close-longLevel)<=tol && r[curIdx].close>r[curIdx].open);
      shortSig=(emaFast<emaSlow && MathAbs(r[curIdx].close-shortLevel)<=tol && r[curIdx].close<r[curIdx].open);
   }
   else if(QM_FAMILY_CODE==44)
   {
      // Python ROLLING_ZSCORE parity with previous-bar threshold crossing.
      int curIdx=n-1,prevIdx=n-2;
      double smaCur=RollingCloseMeanAt(r,SLOW,curIdx);
      double stdCur=RollingCloseStdPopulationAt(r,SLOW,curIdx);
      double smaPrev=RollingCloseMeanAt(r,SLOW,prevIdx);
      double stdPrev=RollingCloseStdPopulationAt(r,SLOW,prevIdx);
      if(smaCur==EMPTY_VALUE || stdCur==EMPTY_VALUE || smaPrev==EMPTY_VALUE || stdPrev==EMPTY_VALUE) return 0;
      double zCur=(r[curIdx].close-smaCur)/MathMax(stdCur,1e-9);
      double zPrev=(r[prevIdx].close-smaPrev)/MathMax(stdPrev,1e-9);
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(zCur>=P1 && zPrev<P1 && emaFast>emaSlow);
      shortSig=(zCur<=-P1 && zPrev>-P1 && emaFast<emaSlow);
   }
   else if(QM_FAMILY_CODE==47)
   {
      // Python REGRESSION_CHANNEL_BREAKOUT parity.
      int curIdx=n-1;
      double sma=RollingCloseMeanAt(r,SLOW,curIdx);
      double std=RollingCloseStdPopulationAt(r,SLOW,curIdx);
      double atrSlow=RollingATRAt(r,SLOW,curIdx);
      if(sma==EMPTY_VALUE || std==EMPTY_VALUE || atrSlow==EMPTY_VALUE || atrSlow<=0.0) return 0;
      double slope=RollingLinRegSlopeAt(r,SLOW,curIdx);
      double normSlope=slope/MathMax(atrSlow,1e-9);
      double upper=sma+P2*std;
      double lower=sma-P2*std;
      double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
      longSig=(r[curIdx].close>upper && normSlope>=P1 && emaFast>emaSlow);
      shortSig=(r[curIdx].close<lower && normSlope<=-P1 && emaFast<emaSlow);
   }
   else
   {
      PrintFormat("GOLD24_SIGNAL_FAIL unsupported family code=%d",QM_FAMILY_CODE);
      return 0;
   }

   if(DIRECTION_MODE=="LONG_ONLY") shortSig=false;
   if(DIRECTION_MODE=="SHORT_ONLY") longSig=false;
   if(longSig && !shortSig) return 1;
   if(shortSig && !longSig) return -1;
   return 0;
}

double N(const double price)
{
   int digits=(int)SymbolInfoInteger(gTradeSymbol,SYMBOL_DIGITS);
   return NormalizeDouble(price,digits);
}

bool ModifyStopsAfterMarket(const int side)
{
   if(!PositionSelect(gTradeSymbol)) return false;
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double sl=N(side==1 ? entry-SL_USD : entry+SL_USD);
   double tp=N(side==1 ? entry+TP_USD : entry-TP_USD);
   ResetLastError();
   bool ok=trade.PositionModify(gTradeSymbol,sl,tp);
   uint rc=trade.ResultRetcode();
   if(ok && RetcodeAccepted(rc)) return true;
   gTradeErrors++;
   int err=GetLastError();
   string desc=trade.ResultRetcodeDescription();
   AppendTradeError("STOP_MODIFY",rc,desc,err);
   PrintFormat("GOLD24_STOP_MODIFY_FAIL retcode=%u desc=%s err=%d",rc,desc,err);
   return false;
}

bool PlaceGapMarket(const int side)
{
   ResetLastError();
   bool ok=(side==1) ? trade.Buy(gLot,gTradeSymbol,0.0,0.0,0.0,QM_TAG) : trade.Sell(gLot,gTradeSymbol,0.0,0.0,0.0,QM_TAG);
   if(!RecordTradeResult(ok,side==1?"BUY_GAP_MARKET":"SELL_GAP_MARKET")) return false;
   gGapMarketFills++;
   return ModifyStopsAfterMarket(side);
}

bool PlaceCanonicalPending(const int side)
{
   double close1=iClose(gSignalSymbol,PERIOD_D1,1); if(close1<=0.0) return false;
   double open0=iOpen(gSignalSymbol,PERIOD_D1,0); if(open0<=0.0) open0=close1;
   bool isStop=(ENTRY_METHOD=="STOP");
   bool isLimit=(ENTRY_METHOD=="LIMIT");
   if(!isStop && !isLimit)
   {
      gTradeErrors++;
      AppendTradeError("ENTRY_METHOD",0,ENTRY_METHOD,0);
      return false;
   }
   double price=isStop
      ? (side==1 ? close1+OFFSET_USD : close1-OFFSET_USD)
      : (side==1 ? close1-OFFSET_USD : close1+OFFSET_USD);

   // Canonical Python fills at the new-bar open when it has already crossed the pending level.
   bool gapFill=isStop
      ? ((side==1 && open0>=price) || (side==-1 && open0<=price))
      : ((side==1 && open0<price) || (side==-1 && open0>price));
   if(InpAllowGapMarketFill && gapFill)
      return PlaceGapMarket(side);

   double sl=(side==1 ? price-SL_USD : price+SL_USD);
   double tp=(side==1 ? price+TP_USD : price-TP_USD);
   price=N(price); sl=N(sl); tp=N(tp);
   ResetLastError();
   bool ok=false;
   string action="";
   if(isStop)
   {
      ok=(side==1)
         ? trade.BuyStop(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,QM_TAG)
         : trade.SellStop(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,QM_TAG);
      action=(side==1?"BUY_STOP":"SELL_STOP");
   }
   else
   {
      ok=(side==1)
         ? trade.BuyLimit(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,QM_TAG)
         : trade.SellLimit(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,QM_TAG);
      action=(side==1?"BUY_LIMIT":"SELL_LIMIT");
   }
   return RecordTradeResult(ok,action);
}

int OnInit()
{
   gSignalSymbol=InpSignalSymbol;
   gTradeSymbol=InpTradeSymbol;
   if(gSignalSymbol=="") gSignalSymbol=_Symbol;
   if(gTradeSymbol=="") gTradeSymbol=_Symbol;
   gParity=InpParityMode;
   if((bool)MQLInfoInteger(MQL_TESTER) && StringFind(_Symbol,"GOLD24-CANON")>=0)
   {
      gSignalSymbol=_Symbol;
      gTradeSymbol=_Symbol;
      gParity=true;
   }
   if(!EnsureSymbolReady(gSignalSymbol) || !EnsureSymbolReady(gTradeSymbol)){WriteReceipt("INIT_FAIL_SYMBOL",0);return INIT_FAILED;}
   gLot=NormalizeVolumeForSymbol(gTradeSymbol,InpLot);
   if(gLot<=0.0){WriteReceipt("INIT_FAIL_VOLUME",0);return INIT_FAILED;}
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetAsyncMode(false);
   trade.SetDeviationInPoints((ulong)MathMax(0,InpDeviationPoints));
   trade.SetTypeFillingBySymbol(gTradeSymbol);

   MqlRates probe[];
   int copied=CopyRates(gSignalSymbol,PERIOD_D1,0,MathMax(160,SLOW+3),probe);
   if(copied<=0){Print("GOLD24_INIT_FAIL no D1 history");WriteReceipt("INIT_FAIL_HISTORY",0);return INIT_FAILED;}
   datetime first=(datetime)SeriesInfoInteger(gSignalSymbol,PERIOD_D1,SERIES_FIRSTDATE);
   if(gParity && (first==0 || first>CANONICAL_START))
   {
      PrintFormat("GOLD24_INIT_FAIL parity history starts %s, need <= %s",TimeToString(first),TimeToString(CANONICAL_START));
      WriteReceipt("INIT_FAIL_PARITY_HISTORY",0); return INIT_FAILED;
   }
   FileDelete(ReceiptPath(),FILE_COMMON);
   PrintFormat("GOLD24_INIT_PASS signal=%s trade=%s lot=%.2f parity=%s first=%s",gSignalSymbol,gTradeSymbol,gLot,gParity?"true":"false",TimeToString(first));
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   string status=(gTradeErrors==0 ? "PASS" : "PASS_WITH_TRADE_ERRORS");
   WriteReceipt(status,reason);
}

void OnTick()
{
   if(!NewSignalBar()) return;
   CancelExpiredPending();
   if(HasOurPosition() || OurPendingTicket()!=0) return;
   int signal=CanonicalSignal();
   if(signal==0) return;
   gSignals++;
   PlaceCanonicalPending(signal);
}

#endif
