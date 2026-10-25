/** Chart-only reduction. Exact price events remain in the ledger/history table. */
export function chartSamples(points) {
 if(points.length<=2)return points;
 const buckets=new Map();
 for(const p of points.slice(1,-1))buckets.set(Math.floor(p.at/30),p);
 const result=[points[0],...buckets.values(),points.at(-1)];
 if(result.length<=32)return result;
 return Array.from({length:32},(_,i)=>result[Math.round(i*(result.length-1)/31)]);
}

/** Confirmed value in effect at each clock hour, within the valid history. */
export function hourlyPoints(points, end) {
 if (!points.length) return [];
 const result=[];
 let index=0;
 for(let at=Math.ceil(points[0].at/60)*60;at<=end;at+=60){
  while(index+1<points.length && points[index+1].at<=at)index++;
  result.push({...points[index],at});
 }
 return result;
}
