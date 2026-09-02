// GOLD24 qualified D1 canonical custom-symbol importer for native MT5 certification.
#property strict
#property script_show_inputs
input string InpOriginSymbol = "XAUUSD";
input string InpCustomSymbol = "GOLD24-CANON";
input string InpCsvFile = "Gold24Qualified\\gold24_canonical_d1_mt5.csv";
input string InpReceiptFile = "Gold24Qualified\\import_receipt.txt";
input int InpExpectedRows = 6500;

void Fail(string msg,int code=2)
{
   Print("GOLD24_IMPORT_FAIL ",msg," err=",GetLastError());
   int r=FileOpen(InpReceiptFile,FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(r!=INVALID_HANDLE){FileWriteString(r,StringFormat("status=FAIL\nmessage=%s\nerror=%d\n",msg,GetLastError()));FileClose(r);}
   if(MQLInfoInteger(MQL_STARTED_FROM_CONFIG)) TerminalClose(code);
}

void FlushChunk(MqlRates &rates[],int used,int &total)
{
   if(used<=0) return;
   ArrayResize(rates,used);
   ResetLastError();
   int n=CustomRatesUpdate(InpCustomSymbol,rates,used);
   if(n<0){Fail("CustomRatesUpdate",11);return;}
   total+=n;
}

void OnStart()
{
   bool iscustom=false;
   bool exists=SymbolExist(InpCustomSymbol,iscustom);
   if(!exists)
   {
      ResetLastError();
      if(!CustomSymbolCreate(InpCustomSymbol,"GOLD24",InpOriginSymbol))
      {
         int e=GetLastError(); if(e!=5304){Fail("CustomSymbolCreate",3);return;}
      }
   }
   CustomSymbolSetInteger(InpCustomSymbol,SYMBOL_DIGITS,2);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_POINT,0.01);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_TRADE_TICK_SIZE,0.01);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_TRADE_TICK_VALUE,1.0);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_TRADE_TICK_VALUE_PROFIT,1.0);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_TRADE_TICK_VALUE_LOSS,1.0);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_TRADE_CONTRACT_SIZE,100.0);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_VOLUME_MIN,0.01);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_VOLUME_MAX,100.0);
   CustomSymbolSetDouble(InpCustomSymbol,SYMBOL_VOLUME_STEP,0.01);
   CustomSymbolSetInteger(InpCustomSymbol,SYMBOL_SPREAD,0);
   CustomSymbolSetInteger(InpCustomSymbol,SYMBOL_SPREAD_FLOAT,false);
   // The canonical TradingView D1 archive is the execution calendar for parity.
   // Do not inherit broker/XAUUSD market-session closures into the custom symbol,
   // otherwise valid canonical bar-open order/delete operations return retcode 10018.
   datetime session_from=D'1970.01.01 00:00:00';
   datetime session_to=D'1970.01.01 23:59:59';
   for(int d=0;d<7;d++)
   {
      ENUM_DAY_OF_WEEK dow=(ENUM_DAY_OF_WEEK)d;
      if(!CustomSymbolSetSessionQuote(InpCustomSymbol,dow,0,session_from,session_to))
         PrintFormat("GOLD24_SESSION_WARN quote day=%d err=%d",d,GetLastError());
      if(!CustomSymbolSetSessionTrade(InpCustomSymbol,dow,0,session_from,session_to))
         PrintFormat("GOLD24_SESSION_WARN trade day=%d err=%d",d,GetLastError());
   }
   SymbolSelect(InpCustomSymbol,true);
   CustomRatesDelete(InpCustomSymbol,D'1990.01.01 00:00:00',D'2035.01.01 00:00:00');

   int h=FileOpen(InpCsvFile,FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON,',');
   if(h==INVALID_HANDLE){Fail("FileOpen "+InpCsvFile,4);return;}
   for(int i=0;i<6 && !FileIsEnding(h);i++) FileReadString(h);

   const int CHUNK=2000;
   MqlRates rates[]; ArrayResize(rates,CHUNK);
   int used=0,total=0,rows=0;
   while(!FileIsEnding(h))
   {
      string ds=FileReadString(h); if(ds=="" && FileIsEnding(h)) break;
      string os=FileReadString(h),hs=FileReadString(h),ls=FileReadString(h),cs=FileReadString(h),vs=FileReadString(h);
      datetime t=StringToTime(ds); if(t<=0) continue;
      rates[used].time=t;
      rates[used].open=StringToDouble(os);
      rates[used].high=StringToDouble(hs);
      rates[used].low=StringToDouble(ls);
      rates[used].close=StringToDouble(cs);
      long v=(long)StringToInteger(vs); if(v<=0)v=1;
      rates[used].tick_volume=v; rates[used].real_volume=v; rates[used].spread=0;
      used++; rows++;
      if(used>=CHUNK){FlushChunk(rates,used,total);used=0;ArrayResize(rates,CHUNK);}
   }
   FileClose(h);
   if(used>0) FlushChunk(rates,used,total);
   Sleep(1000);
   int bars=Bars(InpCustomSymbol,PERIOD_D1,D'2000.10.23 00:00:00',D'2026.08.28 00:00:00');
   bool ok=(rows==InpExpectedRows && bars==InpExpectedRows);
   int r=FileOpen(InpReceiptFile,FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(r!=INVALID_HANDLE)
   {
      FileWriteString(r,StringFormat("status=%s\nrows_read=%d\nbars_mt5=%d\nupdates=%d\ncustom_symbol=%s\ndigits=2\npoint=0.01\nspread_points=0\ncontract_size=100\n",ok?"PASS":"FAIL",rows,bars,total,InpCustomSymbol));
      FileClose(r);
   }
   PrintFormat("GOLD24_IMPORT_DONE status=%s rows=%d bars=%d updates=%d",ok?"PASS":"FAIL",rows,bars,total);
   if(MQLInfoInteger(MQL_STARTED_FROM_CONFIG)) TerminalClose(ok?0:12);
}
