// v9-ui.js — UI rendering, charts, interactions
let priceChart,volumeChart,provChart;

function initCharts(){
  priceChart=echarts.init(document.getElementById('priceChart'));
  volumeChart=echarts.init(document.getElementById('volumeChart'));
  provChart=echarts.init(document.getElementById('provinceChart'));
  window.addEventListener('resize',()=>{priceChart.resize();volumeChart.resize();provChart.resize();});
}

function initCommodityDropdown(){
  const sel=document.getElementById('commodityFilter');
  
  // Group products by Category
  const groups={};
  allData.forEach(d=>{
    if(!d.Category)return;
    if(!groups[d.Category])groups[d.Category]=new Set();
    groups[d.Category].add(d.Product);
  });
  
  let html='';
  Object.keys(groups).sort().forEach(cat=>{
    html+=`<optgroup label="${cat}">`;
    Array.from(groups[cat]).sort().forEach(item=>{
      html+=`<option value="${item}"${item===currentProduct?' selected':''}>${item}</option>`;
    });
    html+='</optgroup>';
  });
  
  if(Object.keys(groups).length===0)html='<option disabled>No data</option>';
  
  sel.innerHTML=html;
  sel.onchange=function(){currentProduct=this.value;populateProvDropdown();updateAll();};
}

function populateProvDropdown(){
  const drop=document.getElementById('provDrop');
  const provs=[...new Set(allData.filter(d=>d.Product===currentProduct&&d.Closing>0).map(d=>d.Region))].sort();
  let html='';
  provs.forEach(p=>{
    const chk=selectedProvs.includes(p)?'checked':'';
    html+=`<label><input type="checkbox" class="prov-chk" value="${p}" ${chk} onchange="handleProvChange()"> ${p}</label>`;
  });
  if(provs.length===0)html='<div style="padding:10px;font-size:11px;color:var(--text3)">No data</div>';
  drop.innerHTML=html;
  populateStationDropdown();
}

function populateStationDropdown(){
  const drop=document.getElementById('stationDrop');
  const prodData=allData.filter(d=>d.Product===currentProduct&&d.Closing>0);
  let html='';
  if(selectedProvs.length===0){
    html='<div style="padding:10px;font-size:11px;color:var(--text3)">Select province(s) first</div>';
  }else{
    selectedProvs.forEach(prov=>{
      const stations=[...new Set(prodData.filter(d=>d.Region===prov).map(d=>d.Station))].sort();
      html+=`<div class="group-hdr">${prov}</div>`;
      stations.forEach(s=>{
        const chk=selectedStations.includes(s)?'checked':'';
        html+=`<label><input type="checkbox" class="station-chk" value="${s}" data-region="${prov}" ${chk} onchange="handleStationChange()"> ${s}</label>`;
      });
    });
  }
  drop.innerHTML=html;
  updateBtnLabels();
}

function updateBtnLabels(){
  const pb=document.getElementById('provBtn');
  pb.textContent=selectedProvs.length?selectedProvs.join(', ')+' ▼':'All Provinces ▼';
  const sb=document.getElementById('stationBtn');
  sb.textContent=selectedStations.length?selectedStations.join(', ')+' ▼':'All Stations ▼';
}

function handleProvChange(){
  selectedProvs=Array.from(document.querySelectorAll('.prov-chk:checked')).map(c=>c.value);
  selectedStations=selectedStations.filter(s=>{
    return allData.some(d=>selectedProvs.includes(d.Region)&&d.Station===s);
  });
  populateStationDropdown();
  updateAll();
}

function handleStationChange(){
  selectedStations=Array.from(document.querySelectorAll('.station-chk:checked')).map(c=>c.value);
  updateBtnLabels();
  updateAll();
}

function toggleDrop(id){
  document.querySelectorAll('.dropdown-content').forEach(d=>{
    if(d.id!==id)d.classList.remove('show');
  });
  document.getElementById(id).classList.toggle('show');
}

window.addEventListener('click',e=>{
  if(!e.target.closest('.filter-group')){
    document.querySelectorAll('.dropdown-content').forEach(d=>d.classList.remove('show'));
  }
});

function initPeriodPills(){
  document.querySelectorAll('#mainPeriodPills .time-pill').forEach(btn=>{
    btn.onclick=function(){
      document.querySelectorAll('#mainPeriodPills .time-pill').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      currentPeriod=this.dataset.period;
      document.getElementById('customDates').classList.toggle('show',currentPeriod==='custom');
      updateAll();
    };
  });
  document.querySelectorAll('#tablePeriodPills .time-pill').forEach(btn=>{
    btn.onclick=function(){
      document.querySelectorAll('#tablePeriodPills .time-pill').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      tablePeriod=this.dataset.tperiod;
      renderTable();
    };
  });
}

function updateKPIs(){
  const latest=getLatestData(currentProduct);
  const dates=getFilteredDates(currentPeriod);
  const periodData=getProductData(currentProduct,dates);

  // Natl Avg
  if(latest.length>0){
    const avg=Math.round(latest.reduce((s,d)=>s+d.Closing,0)/latest.length);
    document.getElementById('kpiNatAvg').textContent='₨ '+avg.toLocaleString();
  }else{document.getElementById('kpiNatAvg').textContent='—';}

  // Volume
  const totalVol=latest.reduce((s,d)=>s+d.ArrivalMaunds,0);
  document.getElementById('kpiVolume').textContent=totalVol>0?totalVol.toLocaleString():'—';

  // National Low/High (latest)
  if(latest.length>0){
    const prices=latest.map(d=>d.Closing).filter(p=>p>0);
    const opens=latest.map(d=>d.Opening).filter(p=>p>0);
    const allP=[...prices,...opens];
    if(allP.length>0){
      const lo=Math.min(...allP),hi=Math.max(...allP);
      const loRow=latest.find(d=>d.Opening===lo||d.Closing===lo);
      const hiRow=latest.find(d=>d.Opening===hi||d.Closing===hi);
      document.getElementById('kpiNatHL').textContent='₨'+lo.toLocaleString()+' / ₨'+hi.toLocaleString();
      document.getElementById('kpiNatHLSub').textContent=(loRow?loRow.Station+' · '+loRow.Region:'')+' / '+(hiRow?hiRow.Station+' · '+hiRow.Region:'');
    }
  }else{document.getElementById('kpiNatHL').textContent='—';document.getElementById('kpiNatHLSub').textContent='';}

  // Period Low/High
  const pData=periodData.filter(d=>d.Closing>0);
  if(pData.length>0){
    const allP2=[];
    pData.forEach(d=>{if(d.Opening>0)allP2.push({p:d.Opening,d});if(d.Closing>0)allP2.push({p:d.Closing,d});});
    if(allP2.length>0){
      allP2.sort((a,b)=>a.p-b.p);
      const lo2=allP2[0],hi2=allP2[allP2.length-1];
      document.getElementById('kpiPeriodHL').textContent='₨'+lo2.p.toLocaleString()+' / ₨'+hi2.p.toLocaleString();
      document.getElementById('kpiPeriodHLSub').textContent=lo2.d.Station+' · '+lo2.d.Region+' / '+hi2.d.Station+' · '+hi2.d.Region;
    }
  }else{document.getElementById('kpiPeriodHL').textContent='—';document.getElementById('kpiPeriodHLSub').textContent='';}

  // Station Low/High
  if(selectedStations.length>0){
    const stData=pData.filter(d=>selectedStations.includes(d.Station));
    if(stData.length>0){
      const sp=[];stData.forEach(d=>{if(d.Opening>0)sp.push(d.Opening);if(d.Closing>0)sp.push(d.Closing);});
      const sLo=Math.min(...sp),sHi=Math.max(...sp);
      document.getElementById('kpiStationHL').textContent='₨'+sLo.toLocaleString()+' / ₨'+sHi.toLocaleString();
      document.getElementById('kpiStationHLSub').textContent=selectedStations.join(', ');
    }
  }else{
    document.getElementById('kpiStationHL').textContent='—';
    document.getElementById('kpiStationHLSub').textContent='Select a station';
  }

  // Most Active
  const volByStation={};
  latest.forEach(d=>{
    if(!volByStation[d.Station])volByStation[d.Station]={vol:0,region:d.Region};
    volByStation[d.Station].vol+=d.ArrivalMaunds;
  });
  let maxSt=null,maxVol=0;
  Object.entries(volByStation).forEach(([s,v])=>{if(v.vol>maxVol){maxVol=v.vol;maxSt=s;}});
  if(maxSt&&maxVol>0){
    document.getElementById('kpiActive').textContent=maxSt;
    document.getElementById('kpiActiveSub').textContent=maxVol.toLocaleString()+' maunds · '+volByStation[maxSt].region;
  }else{document.getElementById('kpiActive').textContent='—';document.getElementById('kpiActiveSub').textContent='';}
}

function renderPriceChart(){
  const dates=getFilteredDates(currentPeriod);
  const sortedDates=[...new Set(dates.map(d=>d.getTime()))].sort().map(t=>new Date(t));
  const productData=allData.filter(d=>d.Product===currentProduct&&d.Closing>0);
  const series=[];
  let colorIdx=0;

  if(selectedProvs.length===0){
    // National average
    const priceMap={};
    sortedDates.forEach(dt=>{
      const dayData=productData.filter(d=>d.Date&&d.Date.getTime()===dt.getTime());
      if(dayData.length>0)priceMap[dt.getTime()]=Math.round(dayData.reduce((s,d)=>s+d.Closing,0)/dayData.length);
    });
    const vals=forwardFill(sortedDates,priceMap);
    if(sortedDates.length===1&&productData.length>0){
      const dayData=productData.filter(d=>d.Date&&d.Date.getTime()===sortedDates[0].getTime());
      const avgOpen=Math.round(dayData.reduce((s,d)=>s+d.Opening,0)/dayData.length);
      const avgClose=Math.round(dayData.reduce((s,d)=>s+d.Closing,0)/dayData.length);
      series.push({name:'National Avg',type:'line',data:[avgOpen,avgClose],smooth:false,symbolSize:6,lineStyle:{width:2.5},itemStyle:{color:'#00d085'}});
    }else{
      series.push({name:'National Avg',type:'line',data:vals,smooth:true,symbolSize:3,lineStyle:{width:2},itemStyle:{color:'#00d085'},areaStyle:{color:'rgba(0,208,133,0.05)'}});
    }
  }else{
    selectedProvs.forEach(prov=>{
      const provStations=selectedStations.filter(s=>productData.some(d=>d.Region===prov&&d.Station===s));
      const color=PROV_COLORS[prov]||LINE_COLORS[colorIdx%LINE_COLORS.length];
      colorIdx++;
      if(provStations.length===0){
        const priceMap={};
        sortedDates.forEach(dt=>{
          const dayData=productData.filter(d=>d.Region===prov&&d.Date&&d.Date.getTime()===dt.getTime());
          if(dayData.length>0)priceMap[dt.getTime()]=Math.round(dayData.reduce((s,d)=>s+d.Closing,0)/dayData.length);
        });
        const vals=forwardFill(sortedDates,priceMap);
        if(sortedDates.length===1){
          const dayData=productData.filter(d=>d.Region===prov&&d.Date&&d.Date.getTime()===sortedDates[0].getTime());
          if(dayData.length>0){
            const ao=Math.round(dayData.reduce((s,d)=>s+d.Opening,0)/dayData.length);
            const ac=Math.round(dayData.reduce((s,d)=>s+d.Closing,0)/dayData.length);
            series.push({name:prov,type:'line',data:[ao,ac],smooth:false,symbolSize:6,lineStyle:{width:2},itemStyle:{color}});
          }
        }else{
          series.push({name:prov,type:'line',data:vals,smooth:true,symbolSize:3,lineStyle:{width:2},itemStyle:{color}});
        }
      }else{
        provStations.forEach(station=>{
          const priceMap={};
          sortedDates.forEach(dt=>{
            const dayData=productData.filter(d=>d.Region===prov&&d.Station===station&&d.Date&&d.Date.getTime()===dt.getTime());
            if(dayData.length>0)priceMap[dt.getTime()]=dayData[0].Closing;
          });
          const vals=forwardFill(sortedDates,priceMap);
          const sc=LINE_COLORS[colorIdx%LINE_COLORS.length];colorIdx++;
          if(sortedDates.length===1){
            const dd=productData.find(d=>d.Region===prov&&d.Station===station&&d.Date&&d.Date.getTime()===sortedDates[0].getTime());
            if(dd)series.push({name:station+' ('+prov+')',type:'line',data:[dd.Opening,dd.Closing],smooth:false,symbolSize:6,lineStyle:{width:2},itemStyle:{color:sc}});
          }else{
            series.push({name:station+' ('+prov+')',type:'line',data:vals,smooth:true,symbolSize:3,lineStyle:{width:2},itemStyle:{color:sc}});
          }
        });
      }
    });
  }

  const xLabels=sortedDates.length===1?['Opening','Closing']:sortedDates.map(d=>(d.getMonth()+1)+'/'+d.getDate());
  
  const bg3 = getComputedStyle(document.documentElement).getPropertyValue('--bg3').trim();
  const text = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const text2 = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim();
  const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim();
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

  const chartOpts={
    backgroundColor:'transparent',
    tooltip:{trigger:'axis',backgroundColor:bg3,borderColor:border,textStyle:{color:text,fontFamily:'Outfit',fontSize:12}},
    legend:{top:0,type:'scroll',textStyle:{color:text2,fontSize:11}},
    grid:{left:'3%',right:'4%',bottom:'10%',top:'40px',containLabel:true},
    xAxis:{type:'category',data:xLabels,axisLine:{lineStyle:{color:border}},axisLabel:{color:text3,fontSize:10,fontFamily:'Outfit'},splitLine:{show:false}},
    yAxis:{type:'value',scale:true,axisLine:{show:false},axisLabel:{color:text3,fontSize:10,fontFamily:'JetBrains Mono',formatter:v=>'₨'+v.toLocaleString()},splitLine:{lineStyle:{color:border,width:.5}}},
    dataZoom:sortedDates.length>7?[{type:'inside'},{type:'slider',height:18,bottom:0,borderColor:border,fillerColor:'rgba(0,208,133,.1)',handleStyle:{color:'#00d085'},textStyle:{color:text3,fontSize:10}}]:[],
    series
  };
  document.getElementById('chartTitle').textContent='Price Trend — '+currentProduct+' (40kg)';
  priceChart.setOption(chartOpts,true);
}

function renderVolumeChart(){
  const latest=getLatestData(currentProduct);
  const volMap={};
  latest.forEach(d=>{
    let key=d.Region;
    if(selectedProvs.length>0&&!selectedProvs.includes(d.Region))return;
    if(selectedStations.length>0){
      if(!selectedStations.includes(d.Station))return;
      key=d.Station;
    }
    volMap[key]=(volMap[key]||0)+d.ArrivalMaunds;
  });
  if(Object.keys(volMap).length===0&&selectedProvs.length===0){
    latest.forEach(d=>{volMap[d.Region]=(volMap[d.Region]||0)+d.ArrivalMaunds;});
  }
  const keys=Object.keys(volMap).sort((a,b)=>volMap[b]-volMap[a]);
  const vals=keys.map(k=>volMap[k]);
  const bg3 = getComputedStyle(document.documentElement).getPropertyValue('--bg3').trim();
  const text = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const text2 = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim();
  const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim();
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

  volumeChart.setOption({
    backgroundColor:'transparent',
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},backgroundColor:bg3,borderColor:border,textStyle:{color:text,fontSize:12}},
    grid:{left:'3%',right:'4%',bottom:'3%',containLabel:true},
    xAxis:{type:'category',data:keys,axisLabel:{color:text3,fontSize:10,rotate:keys.length>6?25:0},axisLine:{lineStyle:{color:border}}},
    yAxis:{type:'value',name:'Maunds',nameTextStyle:{color:text3},axisLabel:{color:text3,fontSize:10,fontFamily:'JetBrains Mono'},splitLine:{lineStyle:{color:border,width:.5}},axisLine:{show:false}},
    series:[{type:'bar',data:vals,itemStyle:{color:'rgba(0,188,212,.4)',borderColor:'#00bcd4',borderWidth:1.5,borderRadius:[3,3,0,0]},label:{show:vals.length<15,position:'top',color:text2,fontSize:10,fontFamily:'JetBrains Mono'}}]
  },true);
}

function renderProvinceChart(){
  const latest=getLatestData(currentProduct);
  const provData={};
  latest.forEach(d=>{
    if(!provData[d.Region])provData[d.Region]={sum:0,count:0};
    provData[d.Region].sum+=d.Closing;provData[d.Region].count++;
  });
  const provs=Object.keys(provData).sort();
  const avgs=provs.map(p=>Math.round(provData[p].sum/provData[p].count));
  const colors=provs.map(p=>PROV_COLORS[p]||'#888');
  const bg3 = getComputedStyle(document.documentElement).getPropertyValue('--bg3').trim();
  const text = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim();
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

  provChart.setOption({
    backgroundColor:'transparent',
    tooltip:{trigger:'axis',backgroundColor:bg3,borderColor:border,textStyle:{color:text,fontSize:11},formatter:p=>p[0].name+': ₨'+p[0].value.toLocaleString()},
    grid:{left:'3%',right:'4%',bottom:'3%',containLabel:true},
    xAxis:{type:'category',data:provs,axisLabel:{color:text3,fontSize:10},axisLine:{lineStyle:{color:border}}},
    yAxis:{type:'value',scale:true,axisLabel:{color:text3,fontSize:10,fontFamily:'JetBrains Mono',formatter:v=>'₨'+(v/1000).toFixed(1)+'K'},splitLine:{lineStyle:{color:border,width:.5}},axisLine:{show:false}},
    series:[{type:'bar',data:avgs.map((v,i)=>({value:v,itemStyle:{color:colors[i]+'33',borderColor:colors[i],borderWidth:1.5}})),barWidth:'50%',itemStyle:{borderRadius:[3,3,0,0]}}]
  },true);
}

function renderGainersLosers(){
  const latest=getLatestData(currentProduct);
  const withChg=latest.filter(d=>d.Opening>0&&d.Closing>0).map(d=>({
    ...d,chgPct:((d.Closing-d.Opening)/d.Opening*100).toFixed(1)
  }));
  withChg.sort((a,b)=>b.chgPct-a.chgPct);
  const gainers=withChg.filter(d=>d.chgPct>0).slice(0,4);
  const losers=withChg.filter(d=>d.chgPct<0).slice(-4).reverse();
  document.getElementById('gainersList').innerHTML=gainers.length?gainers.map(r=>`
    <div class="gl-item gain">
      <div><div class="gl-station">${r.Station}</div><div class="gl-province">${r.Region}</div></div>
      <span class="gl-price">₨${r.Closing.toLocaleString()}</span>
      <span class="gl-chg up">+${r.chgPct}%</span>
    </div>`).join(''):'<div style="color:var(--text3);font-size:10px;padding:8px">No gainers</div>';
  document.getElementById('losersList').innerHTML=losers.length?losers.map(r=>`
    <div class="gl-item loss">
      <div><div class="gl-station">${r.Station}</div><div class="gl-province">${r.Region}</div></div>
      <span class="gl-price">₨${r.Closing.toLocaleString()}</span>
      <span class="gl-chg dn">${r.chgPct}%</span>
    </div>`).join(''):'<div style="color:var(--text3);font-size:10px;padding:8px">No losers</div>';
}

function renderHeatmap(){
  const latest=getLatestData(currentProduct);
  if(latest.length===0){document.getElementById('heatmapGrid').innerHTML='';return;}
  const prices=latest.filter(d=>d.Closing>0);
  const mn=Math.min(...prices.map(d=>d.Closing));
  const mx=Math.max(...prices.map(d=>d.Closing));
  document.getElementById('hmLegend').textContent='₨'+mn.toLocaleString()+' — ₨'+mx.toLocaleString();
  document.getElementById('heatmapGrid').innerHTML=prices.sort((a,b)=>b.Closing-a.Closing).map(d=>{
    const t=mx>mn?(d.Closing-mn)/(mx-mn):0.5;
    // Blue to Red gradient (rgb(33,150,243) -> rgb(255,71,87))
    const r=Math.round(33 + t*(255-33));
    const g=Math.round(150 + t*(71-150));
    const b2=Math.round(243 + t*(87-243));
    const opacity=0.7+t*0.3;
    const abbr=d.Station.length>6?d.Station.slice(0,6)+'…':d.Station;
    return `<div class="hm-cell" style="background:rgb(${r},${g},${b2});opacity:${opacity}" title="${d.Station} (${d.Region}): ₨${d.Closing.toLocaleString()}">
      ${abbr}<div class="hm-price">₨${d.Closing.toLocaleString()}</div></div>`;
  }).join('');
}

function renderTable(){
  const dates=getFilteredDates(tablePeriod);
  const data=getProductData(currentProduct,dates).filter(d=>d.Closing>0);
  const q=(document.getElementById('tableSearch').value||'').toLowerCase();
  // Aggregate by station
  const stMap={};
  data.forEach(d=>{
    if(!stMap[d.Station])stMap[d.Station]={Region:d.Region,opens:[],closes:[],vol:0};
    if(d.Opening>0)stMap[d.Station].opens.push(d.Opening);
    if(d.Closing>0)stMap[d.Station].closes.push(d.Closing);
    stMap[d.Station].vol+=d.ArrivalMaunds;
  });
  let rows=Object.entries(stMap).map(([station,v])=>{
    const open=v.opens.length?Math.round(v.opens[0]):0;
    const close=v.closes.length?Math.round(v.closes[v.closes.length-1]):0;
    const chg=open>0?((close-open)/open*100).toFixed(1):0;
    const hi=Math.max(...v.closes,...v.opens);
    const lo=Math.min(...v.closes.filter(p=>p>0),...v.opens.filter(p=>p>0));
    return{station,region:v.Region,open,close,chg:parseFloat(chg),vol:v.vol,hi,lo};
  });
  if(q)rows=rows.filter(r=>r.station.toLowerCase().includes(q)||r.region.toLowerCase().includes(q));
  rows.sort((a,b)=>b.close-a.close);
  const maxVol=Math.max(...rows.map(r=>r.vol),1);
  document.getElementById('tableTitle').textContent='Live Market Table — '+currentProduct;
  document.getElementById('marketTableBody').innerHTML=rows.map(r=>{
    const cc=r.chg>=0?'up':'down';
    const sign=r.chg>=0?'+':'';
    const vw=Math.round((r.vol/maxVol)*60);
    return `<tr>
      <td class="station">${r.station}</td>
      <td><span class="province-tag">${r.region}</span></td>
      <td class="price-cell">${r.open>0?'₨'+r.open.toLocaleString():'—'}</td>
      <td class="price-cell">${r.close>0?'₨'+r.close.toLocaleString():'—'}</td>
      <td class="chg-cell ${cc}">${sign}${r.chg}%</td>
      <td>${r.vol>0?'<div class="vol-bar" style="width:'+vw+'px"></div>'+r.vol.toLocaleString():'—'}</td>
      <td class="price-cell">${r.hi>0?'₨'+r.hi.toLocaleString():'—'}</td>
      <td class="price-cell">${r.lo>0&&r.lo<Infinity?'₨'+r.lo.toLocaleString():'—'}</td>
    </tr>`;
  }).join('');
}

function updateStatusBar(){
  const latest=getLatestData(currentProduct);
  const stations=new Set(latest.map(d=>d.Station));
  const provs=new Set(latest.map(d=>d.Region));
  document.getElementById('statStations').textContent=stations.size;
  document.getElementById('statProvinces').textContent=provs.size;
}

function updateAll(){
  updateKPIs();
  renderPriceChart();
  renderVolumeChart();
  renderProvinceChart();
  renderGainersLosers();
  renderHeatmap();
  renderTable();
  updateStatusBar();
}

function toggleTheme() {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === 'dark') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', 'dark');
  }
  updateAll();
}

function exportData() {
  const dates = getFilteredDates(currentPeriod);
  let filteredData = getProductData(currentProduct, dates).filter(d => d.Closing > 0);
  
  if (selectedProvs.length > 0) {
    filteredData = filteredData.filter(d => selectedProvs.includes(d.Region));
  }
  if (selectedStations.length > 0) {
    filteredData = filteredData.filter(d => selectedStations.includes(d.Station));
  }
  
  const pricesSheetData = filteredData.map(d => ({
    Date: d.DateStr,
    Province: d.Region,
    Station: d.Station,
    Commodity: d.Product,
    "Opening Price": d.Opening,
    "Closing Price": d.Closing
  }));
  
  const supplySheetData = filteredData.map(d => ({
    Date: d.DateStr,
    Province: d.Region,
    Station: d.Station,
    Commodity: d.Product,
    "Arrival Volume (Maunds)": d.ArrivalMaunds
  }));
  
  const wb = XLSX.utils.book_new();
  const wsPrices = XLSX.utils.json_to_sheet(pricesSheetData);
  const wsSupply = XLSX.utils.json_to_sheet(supplySheetData);
  
  XLSX.utils.book_append_sheet(wb, wsPrices, "Prices");
  XLSX.utils.book_append_sheet(wb, wsSupply, "Supply");
  
  const filename = `zarai_mandi_export_${currentProduct}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Clock
function startClock(){
  const update=()=>{
    document.getElementById('clockDisplay').textContent=new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  };
  update();setInterval(update,1000);
}

// Init
async function init(){
  initCharts();
  startClock();
  const csv=await loadCSV();
  if(!csv){
    document.querySelector('.main').innerHTML='<div class="error-banner">Could not load zarai_mandi_market_data.csv.<br>Please serve this page from a local HTTP server.<br><code style="font-size:11px;color:var(--text2)">python -m http.server 8000</code></div>';
    return;
  }
  const parsed=parseCSV(csv);
  allData=aggregateData(parsed);
  allDates=[...new Set(allData.filter(d=>d.Date).map(d=>d.Date.getTime()))].map(t=>new Date(t));
  allProducts=[...new Set(allData.map(d=>d.Product))];
  allRegions=[...new Set(allData.map(d=>d.Region))];
  if(allProducts.length>0&&!allProducts.includes(currentProduct))currentProduct=allProducts[0];
  initCommodityDropdown();
  populateProvDropdown();
  initPeriodPills();
  document.getElementById('tableSearch').addEventListener('input',()=>renderTable());
  updateAll();
}

init();
