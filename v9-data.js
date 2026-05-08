// v9-data.js — Data loading, parsing, aggregation
let allData=[], allDates=[], allProducts=[], allRegions=[];
let currentProduct='Wheat', currentPeriod='1D', selectedProvs=[], selectedStations=[];
let tablePeriod='1D';
const PROV_COLORS={Punjab:'#00d085',Sindh:'#2196f3',KPK:'#f0a500',Balochistan:'#9c27b0','Gilgit-Baltistan':'#ff6b7a',Kashmir:'#00bcd4'};
const LINE_COLORS=['#00d085','#2196f3','#f0a500','#9c27b0','#00bcd4','#ff6b7a','#e91e63','#4caf50','#ff9800','#607d8b','#3f51b5','#cddc39','#009688','#ff5722','#795548','#8bc34a','#03a9f4','#673ab7','#f44336','#ffeb3b'];

function parseCSV(str){
  const lines=str.trim().replace(/\r\n/g,'\n').split('\n');
  const hdrs=lines[0].split(',').map(h=>h.trim());
  const data=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const p=lines[i].split(',');
    const row={};
    hdrs.forEach((h,j)=>{row[h]=p[j]?p[j].trim():'';});
    row._category = p[2] ? p[2].trim() : ''; // Dynamically extract Category from 3rd column
    data.push(row);
  }
  return data;
}

function toMaunds(bags,unitKg){
  const b=parseFloat(bags)||0, u=parseFloat(unitKg)||0;
  if(b===0||u===0)return 0;
  return(b*u)/40;
}

function parseDateStr(s){
  if(!s)return null;
  const parts=s.split('/');
  if(parts.length===3){
    const m=parseInt(parts[0])-1,d=parseInt(parts[1]),y=parseInt(parts[2]);
    return new Date(y,m,d);
  }
  return new Date(s);
}

function fmtDate(d){
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return mm+'/'+dd+'/'+d.getFullYear();
}

function aggregateData(rows){
  const grouped={};
  rows.forEach(r=>{
    const region=r['Region']||'';
    const station=r['Station']||'';
    const category=r._category||'';
    const product=r['Product']||'';
    const dateStr=r['Entry-Date']||'';
    if(!region||!station||!product)return;
    const key=region+'|'+station+'|'+product+'|'+dateStr;
    if(!grouped[key]){
      grouped[key]={Region:region,Station:station,Category:category,Product:product,DateStr:dateStr,
        opens:[],closes:[],totalMaunds:0};
    }
    const op=parseFloat(r['Opening'])||0;
    const cl=parseFloat(r['Closing'])||0;
    if(op>0)grouped[key].opens.push(op);
    if(cl>0)grouped[key].closes.push(cl);
    const bags=r['Arrival Quantity (Bags)']||r['Arrival Quantity']||'0';
    const unit=r['Arrival Unit (KG)']||'0';
    grouped[key].totalMaunds+=toMaunds(bags,unit);
  });
  const result=[];
  Object.values(grouped).forEach(g=>{
    if(g.opens.length===0&&g.closes.length===0&&g.totalMaunds===0)return;
    const avgOpen=g.opens.length?g.opens.reduce((a,b)=>a+b,0)/g.opens.length:0;
    const avgClose=g.closes.length?g.closes.reduce((a,b)=>a+b,0)/g.closes.length:0;
    result.push({
      Region:g.Region,Station:g.Station,Category:g.Category,Product:g.Product,DateStr:g.DateStr,
      Date:parseDateStr(g.DateStr),
      Opening:Math.round(avgOpen),Closing:Math.round(avgClose),
      ArrivalMaunds:Math.round(g.totalMaunds)
    });
  });
  return result;
}

function getFilteredDates(period,customFrom,customTo){
  if(allDates.length===0)return[];
  const sorted=[...allDates].sort((a,b)=>a-b);
  const latest=sorted[sorted.length-1];
  let from;
  if(period==='1D')from=latest;
  else if(period==='7D'){from=new Date(latest);from.setDate(from.getDate()-6);}
  else if(period==='30D'){from=new Date(latest);from.setDate(from.getDate()-29);}
  else if(period==='custom'&&customFrom&&customTo){from=new Date(customFrom);latest.setTime(new Date(customTo).getTime());}
  else from=sorted[0];
  return sorted.filter(d=>d>=from&&d<=latest);
}

function getProductData(product,dates){
  if(!dates||dates.length===0)dates=allDates;
  const dateSet=new Set(dates.map(d=>d.getTime()));
  return allData.filter(d=>d.Product===product&&d.Date&&dateSet.has(d.Date.getTime()));
}

function getLatestData(product){
  if(allDates.length===0)return[];
  const sorted=[...allDates].sort((a,b)=>a-b);
  const latest=sorted[sorted.length-1];
  return allData.filter(d=>d.Product===product&&d.Date&&d.Date.getTime()===latest.getTime()&&d.Closing>0);
}

function forwardFill(sortedDates,priceMap){
  let last=null;
  return sortedDates.map(d=>{
    const key=d.getTime();
    if(priceMap[key]!=null&&priceMap[key]>0)last=priceMap[key];
    return last;
  });
}

async function loadCSV(){
  try{
    const resp=await fetch('./zarai_mandi_market_data.csv');
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    return await resp.text();
  }catch(e){
    console.error('Fetch failed:',e);
    return null;
  }
}
