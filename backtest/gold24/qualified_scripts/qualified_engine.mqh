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
const double SL_USD=QM_SL_USD;
const double TP_USD=QM_TP_USD;
const double OFFSET_USD=QM_OFFSET_USD;
const int EXPIRY_BARS=QM_EXPIRY_BARS;
const string DIRECTION_MODE=QM_DIRECTION_MODE;

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

string ReceiptPath(){ return StringFormat("Gold24Qualified\\receipt_%I64u.txt",InpMagic); }

void WriteReceipt(const string status,const int reason)
{
   int h=FileOpen(ReceiptPath(),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return;
   FileWriteString(h,StringFormat(
      "status=%s\nmagic=%I64u\nsignal_symbol=%s\ntrade_symbol=%s\nparity_mode=%s\nbars=%I64d\nsignals=%I64d\norder_attempts=%I64d\norder_accepted=%I64d\ntrade_errors=%I64d\ngap_market_fills=%I64d\ndeinit_reason=%d\n",
      status,InpMagic,gSignalSymbol,gTradeSymbol,gParity?"true":"false",gBarsSeen,gSignals,gOrderAttempts,gOrderAccepted,gTradeErrors,gGapMarketFills,reason));
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
   PrintFormat("GOLD24_TRADE_FAIL action=%s ok=%s retcode=%u desc=%s last_error=%d",action,ok?"true":"false",rc,trade.ResultRetcodeDescription(),GetLastError());
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
         PrintFormat("GOLD24_DELETE_FAIL ticket=%I64u retcode=%u desc=%s err=%d",ticket,rc,trade.ResultRetcodeDescription(),GetLastError());
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

double PandasEMA(MqlRates &r[],int period)
{
   int n=ArraySize(r); if(n<=0) return EMPTY_VALUE;
   double alpha=2.0/(period+1.0), ema=r[0].close;
   for(int i=1;i<n;i++) ema=alpha*r[i].close+(1.0-alpha)*ema;
   return ema;
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

int CanonicalSignal()
{
   MqlRates r[]; if(!LoadCanonicalRates(r)) return 0;
   int n=ArraySize(r),warmup=MathMax(150,SLOW+2);
   if(n<=warmup) return 0;
   bool longSig=false,shortSig=false;
#if QM_FAMILY_CODE == 1
   if(n<SLOW+1) return 0;
   double rsi=SimpleRollingRSI(r,FAST);
   double rh=-DBL_MAX,rl=DBL_MAX;
   for(int i=n-2;i>=n-SLOW-1;i--){if(r[i].high>rh)rh=r[i].high;if(r[i].low<rl)rl=r[i].low;}
   double closeNow=r[n-1].close;
   longSig=(closeNow>rh && rsi>50.0);
   shortSig=(closeNow<rl && rsi<50.0);
#elif QM_FAMILY_CODE == 2
   if(n<3) return 0;
   MqlRates cur=r[n-1],prev=r[n-2];
   bool bull=(cur.close>cur.open && prev.close<prev.open && cur.close>=prev.open && cur.open<=prev.close);
   bool bear=(cur.close<cur.open && prev.close>prev.open && cur.close<=prev.open && cur.open>=prev.close);
   double emaFast=PandasEMA(r,FAST),emaSlow=PandasEMA(r,SLOW);
   longSig=(bull && emaFast>emaSlow);
   shortSig=(bear && emaFast<emaSlow);
#else
   #error Unsupported QM_FAMILY_CODE
#endif
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
   PrintFormat("GOLD24_STOP_MODIFY_FAIL retcode=%u desc=%s err=%d",rc,trade.ResultRetcodeDescription(),GetLastError());
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
   double price=(side==1 ? close1-OFFSET_USD : close1+OFFSET_USD);

   // Canonical Python fills a LIMIT at bar open if the new bar gaps strictly through the level.
   // Native BuyLimit/SellLimit can be rejected when the market has already crossed that level,
   // so use an immediate market fill on that exact gap case. In parity custom-symbol tests the
   // first tick has zero spread and represents the canonical bar open.
   if(InpAllowGapMarketFill && ((side==1 && open0<price) || (side==-1 && open0>price)))
      return PlaceGapMarket(side);

   double sl=(side==1 ? price-SL_USD : price+SL_USD);
   double tp=(side==1 ? price+TP_USD : price-TP_USD);
   price=N(price); sl=N(sl); tp=N(tp);
   ResetLastError();
   bool ok=(side==1)
      ? trade.BuyLimit(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,QM_TAG)
      : trade.SellLimit(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,QM_TAG);
   return RecordTradeResult(ok,side==1?"BUY_LIMIT":"SELL_LIMIT");
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
