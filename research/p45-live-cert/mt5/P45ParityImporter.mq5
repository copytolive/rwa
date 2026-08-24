//+------------------------------------------------------------------+
//| P45 same-dataset parity custom-symbol importer                   |
//| Imports frozen M1 TSV into a custom MT5 symbol without tuning.   |
//+------------------------------------------------------------------+
#property strict
#property script_show_inputs

input string InpFile   = "GOLDUSDC_M1_2009_2024_MT5_PARITY_DIGITS3.tsv";
input string InpSymbol = "GOLDUSDC-PARITY";
input int    InpChunk  = 50000;

bool SetI(const ENUM_SYMBOL_INFO_INTEGER prop,const long value)
{
   ResetLastError();
   if(!CustomSymbolSetInteger(InpSymbol,prop,value))
   {
      PrintFormat("SETI_FAIL prop=%d value=%I64d err=%d",(int)prop,value,GetLastError());
      return false;
   }
   return true;
}
bool SetD(const ENUM_SYMBOL_INFO_DOUBLE prop,const double value)
{
   ResetLastError();
   if(!CustomSymbolSetDouble(InpSymbol,prop,value))
   {
      PrintFormat("SETD_FAIL prop=%d value=%.8f err=%d",(int)prop,value,GetLastError());
      return false;
   }
   return true;
}

void OnStart()
{
   ResetLastError();
   if(!CustomSymbolCreate(InpSymbol,"Parity"))
   {
      int e=GetLastError();
      if(e!=5304)
      {
         PrintFormat("IMPORT_FAIL stage=create symbol=%s err=%d",InpSymbol,e);
         return;
      }
      PrintFormat("CUSTOM_SYMBOL_EXISTS symbol=%s",InpSymbol);
   }

   bool props=true;
   props &= SetI(SYMBOL_DIGITS,3);
   props &= SetI(SYMBOL_SPREAD,150);
   props &= SetI(SYMBOL_SPREAD_FLOAT,false);
   props &= SetI(SYMBOL_TRADE_MODE,SYMBOL_TRADE_MODE_FULL);
   props &= SetI(SYMBOL_TRADE_CALC_MODE,SYMBOL_CALC_MODE_CFD);
   props &= SetI(SYMBOL_TRADE_STOPS_LEVEL,0);
   props &= SetI(SYMBOL_TRADE_FREEZE_LEVEL,0);
   props &= SetI(SYMBOL_FILLING_MODE,SYMBOL_FILLING_FOK|SYMBOL_FILLING_IOC);
   props &= SetI(SYMBOL_EXPIRATION_MODE,SYMBOL_EXPIRATION_GTC|SYMBOL_EXPIRATION_DAY|SYMBOL_EXPIRATION_SPECIFIED|SYMBOL_EXPIRATION_SPECIFIED_DAY);
   props &= SetI(SYMBOL_ORDER_MODE,SYMBOL_ORDER_MARKET|SYMBOL_ORDER_LIMIT|SYMBOL_ORDER_STOP|SYMBOL_ORDER_STOP_LIMIT|SYMBOL_ORDER_SL|SYMBOL_ORDER_TP);
   props &= SetD(SYMBOL_POINT,0.001);
   props &= SetD(SYMBOL_TRADE_TICK_SIZE,0.001);
   props &= SetD(SYMBOL_TRADE_TICK_VALUE,1.0);
   props &= SetD(SYMBOL_TRADE_TICK_VALUE_PROFIT,1.0);
   props &= SetD(SYMBOL_TRADE_TICK_VALUE_LOSS,1.0);
   props &= SetD(SYMBOL_TRADE_CONTRACT_SIZE,100.0);
   props &= SetD(SYMBOL_VOLUME_MIN,0.01);
   props &= SetD(SYMBOL_VOLUME_MAX,100.0);
   props &= SetD(SYMBOL_VOLUME_STEP,0.01);
   props &= SetD(SYMBOL_MARGIN_INITIAL,1.0);
   props &= SetD(SYMBOL_MARGIN_MAINTENANCE,1.0);
   CustomSymbolSetString(InpSymbol,SYMBOL_DESCRIPTION,"P45 frozen parity custom symbol");
   CustomSymbolSetString(InpSymbol,SYMBOL_CURRENCY_BASE,"XAU");
   CustomSymbolSetString(InpSymbol,SYMBOL_CURRENCY_PROFIT,"USD");
   CustomSymbolSetString(InpSymbol,SYMBOL_CURRENCY_MARGIN,"USD");
   if(!props)
   {
      Print("IMPORT_FAIL stage=properties");
      return;
   }

   datetime s0=StringToTime("1970.01.01 00:00:00");
   datetime s1=StringToTime("1970.01.01 23:59:59");
   for(int d=1; d<=5; d++)
   {
      CustomSymbolSetSessionQuote(InpSymbol,(ENUM_DAY_OF_WEEK)d,0,s0,s1);
      CustomSymbolSetSessionTrade(InpSymbol,(ENUM_DAY_OF_WEEK)d,0,s0,s1);
   }
   SymbolSelect(InpSymbol,true);

   ResetLastError();
   int deleted=CustomRatesDelete(InpSymbol,0,LONG_MAX);
   PrintFormat("CUSTOM_RATES_DELETE result=%d err=%d",deleted,GetLastError());

   int flags=FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON;
   int fh=FileOpen(InpFile,flags,'\t');
   if(fh==INVALID_HANDLE)
   {
      PrintFormat("IMPORT_FAIL stage=file_open file=%s err=%d",InpFile,GetLastError());
      return;
   }

   // 9-column TSV header.
   for(int h=0; h<9 && !FileIsEnding(fh); h++) FileReadString(fh);

   MqlRates rates[];
   int chunk=MathMax(1000,InpChunk);
   ArrayResize(rates,chunk);
   int n=0;
   long total=0;
   datetime first=0,last=0;
   int batches=0;

   while(!FileIsEnding(fh))
   {
      string d=FileReadString(fh);
      if(d=="" && FileIsEnding(fh)) break;
      string t=FileReadString(fh);
      string so=FileReadString(fh);
      string sh=FileReadString(fh);
      string sl=FileReadString(fh);
      string sc=FileReadString(fh);
      string stv=FileReadString(fh);
      string srv=FileReadString(fh);
      string ssp=FileReadString(fh);
      if(d=="" || t=="") continue;

      datetime tm=StringToTime(d+" "+t);
      if(tm<=0)
      {
         PrintFormat("IMPORT_FAIL stage=parse_time date=%s time=%s row=%I64d",d,t,total+1);
         FileClose(fh);
         return;
      }
      rates[n].time=tm;
      rates[n].open=StringToDouble(so);
      rates[n].high=StringToDouble(sh);
      rates[n].low=StringToDouble(sl);
      rates[n].close=StringToDouble(sc);
      rates[n].tick_volume=(long)StringToInteger(stv);
      rates[n].real_volume=(long)StringToInteger(srv);
      rates[n].spread=(int)StringToInteger(ssp);
      if(first==0) first=tm;
      last=tm;
      n++;

      if(n>=chunk)
      {
         ResetLastError();
         int upd=CustomRatesUpdate(InpSymbol,rates,n);
         if(upd<0)
         {
            PrintFormat("IMPORT_FAIL stage=update batch=%d rows=%d err=%d",batches,n,GetLastError());
            FileClose(fh);
            return;
         }
         total+=n;
         batches++;
         if((batches%10)==0) PrintFormat("IMPORT_PROGRESS rows=%I64d batches=%d",total,batches);
         n=0;
      }
   }
   FileClose(fh);

   if(n>0)
   {
      ResetLastError();
      int upd=CustomRatesUpdate(InpSymbol,rates,n);
      if(upd<0)
      {
         PrintFormat("IMPORT_FAIL stage=final_update rows=%d err=%d",n,GetLastError());
         return;
      }
      total+=n;
      batches++;
   }

   Sleep(2000);
   long bars=Bars(InpSymbol,PERIOD_M1);
   long digits=SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
   long spread=SymbolInfoInteger(InpSymbol,SYMBOL_SPREAD);
   double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
   PrintFormat("IMPORT_DONE symbol=%s rows=%I64d bars=%I64d first=%s last=%s digits=%I64d point=%.3f spread=%I64d batches=%d",
               InpSymbol,total,bars,TimeToString(first,TIME_DATE|TIME_SECONDS),TimeToString(last,TIME_DATE|TIME_SECONDS),digits,point,spread,batches);
}
