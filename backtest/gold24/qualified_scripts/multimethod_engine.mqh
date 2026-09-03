#ifndef GOLD24_MULTIMETHOD_ENGINE_COMPAT_MQH
#define GOLD24_MULTIMETHOD_ENGINE_COMPAT_MQH

#ifdef MM_VOLREG_SPECIAL
#property strict
#include <Trade/Trade.mqh>
CTrade trade;

input string InpSignalSymbol = "XAUUSD";
input string InpTradeSymbol  = "XAUUSD";
input double InpLot          = 1.0;
input ulong  InpMagic        = MM_MAGIC;
input bool   InpParityMode   = false;
input int    InpDeviationPoints = 50;

const datetime CANONICAL_START = D'2000.10.23 00:00';
datetime g_lastBar=0;
string gSignalSymbol="";
string gTradeSymbol="";
double gLot=0.0;
long gBarsSeen=0,gSignals=0,gOrderAttempts=0,gOrderAccepted=0,gTradeErrors=0;
string gTradeErrorDetails="";

string ReceiptPath(){return StringFormat("Gold24Qualified\\receipt_%I64u.txt",InpMagic);}
bool Accepted(const uint rc){return rc==TRADE_RETCODE_DONE||rc==TRADE_RETCODE_PLACED||rc==TRADE_RETCODE_DONE_PARTIAL||rc==TRADE_RETCODE_NO_CHANGES;}
void AppendErr(const string a,const uint rc,const string d,const int e){if(StringLen(gTradeErrorDetails)<7000)gTradeErrorDetails+=StringFormat("%s:%u:%s:%d|",a,rc,d,e);}
void WriteReceipt(const string status,const int reason){
  int h=FileOpen(ReceiptPath(),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON); if(h==INVALID_HANDLE)return;
  FileWriteString(h,StringFormat("status=%s\nmagic=%I64u\nsignal_symbol=%s\ntrade_symbol=%s\nparity_mode=%s\nbars=%I64d\nsignals=%I64d\norder_attempts=%I64d\norder_accepted=%I64d\ntrade_errors=%I64d\ngap_market_fills=0\ntrade_error_details=%s\ndeinit_reason=%d\n",
    status,InpMagic,gSignalSymbol,gTradeSymbol,InpParityMode?"true":"false",gBarsSeen,gSignals,gOrderAttempts,gOrderAccepted,gTradeErrors,gTradeErrorDetails,reason)); FileClose(h);
}
double NormVol(const string s,double v){double mn=SymbolInfoDouble(s,SYMBOL_VOLUME_MIN),mx=SymbolInfoDouble(s,SYMBOL_VOLUME_MAX),st=SymbolInfoDouble(s,SYMBOL_VOLUME_STEP);if(mn<=0)mn=0.01;if(mx<=0)mx=MathMax(mn,v);if(st<=0)st=mn;v=MathMax(mn,MathMin(mx,v));v=mn+MathRound((v-mn)/st)*st;return v;}
double N(const double p){return NormalizeDouble(p,(int)SymbolInfoInteger(gTradeSymbol,SYMBOL_DIGITS));}
bool Ready(const string s){return s!=""&&SymbolSelect(s,true);}
bool NewBar(){datetime t=iTime(gSignalSymbol,PERIOD_D1,0);if(t==0||t==g_lastBar)return false;g_lastBar=t;gBarsSeen++;return true;}
bool HasPos(){if(!PositionSelect(gTradeSymbol))return false;return (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic;}
ulong Pending(){for(int i=OrdersTotal()-1;i>=0;i--){ulong t=OrderGetTicket(i);if(t==0)continue;if(OrderGetString(ORDER_SYMBOL)!=gTradeSymbol)continue;if((ulong)OrderGetInteger(ORDER_MAGIC)!=InpMagic)continue;ENUM_ORDER_TYPE ty=(ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);if(ty==ORDER_TYPE_BUY_LIMIT||ty==ORDER_TYPE_SELL_LIMIT||ty==ORDER_TYPE_BUY_STOP||ty==ORDER_TYPE_SELL_STOP)return t;}return 0;}
void CancelExpired(){ulong t=Pending();if(t==0)return;datetime setup=(datetime)OrderGetInteger(ORDER_TIME_SETUP);int bars=iBarShift(gSignalSymbol,PERIOD_D1,setup,false);if(bars>=MM_EXPIRY_BARS){bool ok=trade.OrderDelete(t);uint rc=trade.ResultRetcode();if(!(ok&&Accepted(rc))){gTradeErrors++;AppendErr("DELETE",rc,trade.ResultRetcodeDescription(),GetLastError());}}}

bool LoadRates(MqlRates &r[]){datetime end=iTime(gSignalSymbol,PERIOD_D1,1);if(end==0)return false;ArrayFree(r);int n=CopyRates(gSignalSymbol,PERIOD_D1,CANONICAL_START,end,r);return n>0;}
double EMA(MqlRates &r[],int n){int z=ArraySize(r);if(z<=0)return 0;double a=2.0/(n+1.0),e=r[0].close;for(int i=1;i<z;i++)e=a*r[i].close+(1.0-a)*e;return e;}
double RSI(MqlRates &r[],int n){int z=ArraySize(r);if(z<n+1)return 50.0;double g=0,l=0;for(int i=z-n;i<z;i++){double d=r[i].close-r[i-1].close;if(d>0)g+=d;else if(d<0)l-=d;}g/=n;l/=n;if(l==0)return 50.0;double rs=g/l;return 100.0-100.0/(1.0+rs);}
double TR(MqlRates &r[],int i){if(i<=0)return r[i].high-r[i].low;return MathMax(r[i].high-r[i].low,MathMax(MathAbs(r[i].high-r[i-1].close),MathAbs(r[i].low-r[i-1].close)));}
double ATR(MqlRates &r[],int n){int z=ArraySize(r);if(z<n+1)return 0;double s=0;for(int i=z-n;i<z;i++)s+=TR(r,i);return s/n;}
double MeanClose(MqlRates &r[],int n){int z=ArraySize(r);if(z<n)return 0;double s=0;for(int i=z-n;i<z;i++)s+=r[i].close;return s/n;}
double StdClose(MqlRates &r[],int n,double mean){int z=ArraySize(r);if(z<n)return 0;double s=0;for(int i=z-n;i<z;i++){double d=r[i].close-mean;s+=d*d;}return MathSqrt(s/n);}
void PriorFast(MqlRates &r[],double &hi,double &lo){int z=ArraySize(r);hi=-DBL_MAX;lo=DBL_MAX;int a=MathMax(0,z-1-MM_FAST),b=z-2;for(int i=a;i<=b;i++){if(r[i].high>hi)hi=r[i].high;if(r[i].low<lo)lo=r[i].low;}}

int CanonicalSignal(){
  MqlRates r[];if(!LoadRates(r))return 0;int z=ArraySize(r);if(z<=MathMax(150,MM_SLOW+2))return 0;
  double ef=EMA(r,MM_FAST),es=EMA(r,MM_SLOW),af=ATR(r,MM_FAST),as=ATR(r,MM_SLOW);if(as<=0)return 0;
  double mean=MeanClose(r,MM_SLOW),sd=StdClose(r,MM_SLOW,mean);if(sd<=0)return 0;
  double close=r[z-1].close,zs=(close-mean)/sd,rsi=RSI(r,MM_FAST),rh,rl;PriorFast(r,rh,rl);
  double ratio=af/as;
  bool longSig=((ratio>=MM_P1&&close>rh&&ef>es)||(ratio<=MM_P2&&zs<-1.0&&rsi<40.0));
  bool shortSig=((ratio>=MM_P1&&close<rl&&ef<es)||(ratio<=MM_P2&&zs>1.0&&rsi>60.0));
  if(StringCompare(MM_DIRECTION_MODE,"LONG_ONLY")==0)shortSig=false;
  if(StringCompare(MM_DIRECTION_MODE,"SHORT_ONLY")==0)longSig=false;
  if(longSig&&!shortSig)return 1;if(shortSig&&!longSig)return -1;return 0;
}
bool Record(bool ok,const string action){gOrderAttempts++;uint rc=trade.ResultRetcode();if(ok&&Accepted(rc)){gOrderAccepted++;return true;}gTradeErrors++;AppendErr(action,rc,trade.ResultRetcodeDescription(),GetLastError());return false;}
bool Place(const int side){
  double close1=iClose(gSignalSymbol,PERIOD_D1,1);if(close1<=0)return false;
  double price=side==1?close1-MM_OFFSET_USD:close1+MM_OFFSET_USD;
  double sl=side==1?price-MM_SL_USD:price+MM_SL_USD,tp=side==1?price+MM_TP_USD:price-MM_TP_USD;
  price=N(price);sl=N(sl);tp=N(tp);
  bool ok=side==1?trade.BuyLimit(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,MM_TAG):trade.SellLimit(gLot,price,gTradeSymbol,sl,tp,ORDER_TIME_GTC,0,MM_TAG);
  return Record(ok,side==1?"BUY_LIMIT":"SELL_LIMIT");
}
int OnInit(){
  gSignalSymbol=InpSignalSymbol;gTradeSymbol=InpTradeSymbol;if(gSignalSymbol=="")gSignalSymbol=_Symbol;if(gTradeSymbol=="")gTradeSymbol=_Symbol;
  if((bool)MQLInfoInteger(MQL_TESTER)&&StringFind(_Symbol,"GOLD24-CANON")>=0){gSignalSymbol=_Symbol;gTradeSymbol=_Symbol;}
  if(!Ready(gSignalSymbol)||!Ready(gTradeSymbol)){WriteReceipt("INIT_FAIL_SYMBOL",0);return INIT_FAILED;}
  gLot=NormVol(gTradeSymbol,InpLot);trade.SetExpertMagicNumber(InpMagic);trade.SetAsyncMode(false);trade.SetDeviationInPoints((ulong)MathMax(0,InpDeviationPoints));trade.SetTypeFillingBySymbol(gTradeSymbol);
  MqlRates p[];if(CopyRates(gSignalSymbol,PERIOD_D1,0,MathMax(160,MM_SLOW+3),p)<=0){WriteReceipt("INIT_FAIL_HISTORY",0);return INIT_FAILED;}
  FileDelete(ReceiptPath(),FILE_COMMON);return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){WriteReceipt(gTradeErrors==0?"PASS":"PASS_WITH_TRADE_ERRORS",reason);}
void OnTick(){if(!NewBar())return;CancelExpired();if(HasPos()||Pending()!=0)return;int s=CanonicalSignal();if(s==0)return;gSignals++;Place(s);}

#else
#define QM_FAMILY_CODE MM_FAMILY_CODE
#define QM_FAST MM_FAST
#define QM_SLOW MM_SLOW
#ifdef MM_P1
#define QM_P1 MM_P1
#endif
#ifdef MM_P2
#define QM_P2 MM_P2
#endif
#ifdef MM_P3
#define QM_P3 MM_P3
#endif
#define QM_SL_USD MM_SL_USD
#define QM_TP_USD MM_TP_USD
#define QM_OFFSET_USD MM_OFFSET_USD
#define QM_EXPIRY_BARS MM_EXPIRY_BARS
#define QM_DIRECTION_MODE MM_DIRECTION_MODE
#define QM_MAGIC MM_MAGIC
#define QM_TAG MM_TAG
#include "qualified_engine.mqh"
#endif

#endif
