/*
【测试用】2026-03-30 测试结果：精度比高德地图低好多，并且很多无效图形（存在交叉线段），基本无法正常使用
采集腾讯地图省市区三级坐标和行政区域边界

在以下页面执行
https://lbs.qq.com/webservice_v1/guide-region.html
*/
"use strict";
(function(){

var LimitShenID="23"; //限制只采集一个省的
var MaxOffset=100; //100 500 1000 3000米精度

window.StopLoad=false;//true手动停止运行，"End"假装采集完成
window.DataGeoQQMap=window.DataGeoQQMap||{Ver:"",Root:[], All:{}, shen_ok:0,shen_count:0 ,si_ok:0,si_count:0 ,qu_count:0 };
var Load_Max_Try=3;//错误重试次数
var Load_Wait_Child=91;//此城市下级列表已抓取完毕，等待子级完成抓取
var Load_Full_End=92;//此城市包括下级全部抓取完毕
var Level={
	1:{n:"省",k:"shen"},
	2:{n:"市",k:"si"},
	3:{n:"区",k:"qu"}
};
//重置重试次数
for(var k in DataGeoQQMap.All){
	if(DataGeoQQMap.All[k].load<20){
		DataGeoQQMap.All[k].load=0;
	}
}

var loadReqCount=0,blockReqCount=0,loadT1=Date.now();
var LoadChild=function(loadItem){
	var errTag="请重新执行代码恢复重试：读取省级";
	var levelNext=1;
	if(loadItem){
		loadItem.load++; levelNext=loadItem.level+1;
		errTag="请重新执行代码恢复重试：读取"+Level[loadItem.level].n+"["+loadItem.code+" "+loadItem.name+"]";
		if(loadItem.load>Load_Max_Try){
			console.error(errTag+"超过"+Load_Max_Try+"次");
			return;
		};
	}
	
	var times=Math.round((Date.now()-loadT1)/1000);
	LogX(Math.floor(times/60)+"′"+(times%60)+"″ "+(loadReqCount/times).toFixed(1)+"/s 读取"+loadReqCount+"次 BL:"+blockReqCount+" "+getJD()
		+(loadItem?" ["+loadItem.fullPath.join(" ")+"]"+Level[loadItem.level].n:" 省级"));
	
	loadReqCount++;
	$.ajax({
		url:"https://apis.map.qq.com/ws/district/v1/getchildren?key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77"+(loadItem?"&id="+loadItem.code:"")+"&get_polygon=2&max_offset="+MaxOffset
		,error:function(){
			console.error(errTag+"加载失败");
		}
		,success:function(data){
			if(data.status!=0){
				if(data.status==120){
					blockReqCount++;
					loadItem&&loadItem.load--;//此key每秒请求量已达到上限
					setTimeout(function(){
						LoadChild(loadItem);
					},200);
					return;
				};
				console.error(errTag+"加载状态码"+data.status, data);
				return;
			};
			if(data.result.length!=1){
				console.error(errTag+"加载结果result不是1个", data);
				return;
			};
			if(!DataGeoQQMap.Ver)DataGeoQQMap.Ver=data.data_version;
			if(data.data_version!=DataGeoQQMap.Ver){
				console.error(errTag+"加载结果ver不一致", DataGeoQQMap.Ver, data);
				return;
			};
			
			var list=data.result[0], addCount=0;
			for(var i=0;i<list.length;i++){
				var o=list[i];
				if(LimitShenID && (o.id+"").indexOf(LimitShenID)!=0){
					continue;
				}
				var wktList=[];
				for(var j=0;j<o.polygon.length;j++){
					var arr=o.polygon[j], wkt=[];
					if(!arr.length) continue;
					for(var j2=0;j2<arr.length;){
						var lng=arr[j2++], lat=arr[j2++];
						if(!(+lng) || !(+lat)){
							console.error(errTag+"加载结果第"+(j+1)+"个polygon的第"+(j2+1)+"个坐标无效", data);
							return;
						}
						wkt.push(""+lng+" "+lat+"");
					};
					wkt.push(wkt[0]);
					wktList.push("POLYGON(("+wkt.join(",")+"))");
				};
				var path=[o.fullname], po=loadItem; while(po){ path.push(po.name); po=po.parent; }; path.reverse();
				var item={
					name:o.fullname, fullPath:path
					,code:o.id+"", pCode:loadItem?loadItem.code:0
					,wkts:wktList.join("|")
					,geo:o.location.lng+" "+o.location.lat
					,child:[]
					,parent:loadItem
					,level:levelNext
					,load:0
				};
				DataGeoQQMap.All[item.code]=item;
				if(!loadItem){
					DataGeoQQMap.Root.push(item);
				}else{
					loadItem.child.push(item);
				};
				addCount++;
			};
			if(loadItem) loadItem.load=Load_Wait_Child;
			DataGeoQQMap[Level[levelNext].k+"_count"]+=addCount;
			
			LoadNext();
		}
	});
};


var endload=function(){
	var logTxt="完成："+(Date.now()-loadT1)/1000+"秒"+getJD();
	console.log(logTxt);
	LogX(logTxt);
	
	var list=[]; for(var k in DataGeoQQMap.All) list.push(DataGeoQQMap.All[k]);
	list.sort(function(a,b){ return a.code.localeCompare(b.code); });
	
	var saveList=[];
	for(var i=0;i<list.length;i++){
		var o=list[i];
		
		saveList.push(JSON.stringify({
			code:o.code
			,pCode:o.pCode
			,level:o.level
			,name:o.name
			,ext_path:o.fullPath.join(" ")
			,geo:o.geo
			,wkts:o.wkts
		}));
	};
	
	var url=URL.createObjectURL(
		new Blob([
			new Uint8Array([0xEF,0xBB,0xBF])
			,"var DATA_GEO_QQMapInfo="+JSON.stringify({Ver:DataGeoQQMap.Ver, LimitShenID:LimitShenID, MaxOffset:MaxOffset})+";"
				+"\nvar DATA_GEO_QQMap=[\n"
			,saveList.join(",\n")
			,"\n];"
		]
		,{"type":"text/plain"})
	);
	var downA=document.createElement("A");
	downA.innerHTML="下载查询好坐标的文件";
	downA.href=url;
	downA.download="data_geo_qqmap.txt";
	logX.append(downA);
	downA.click();
	
	console.log("--完成--");
};

var logX=$('<div class="LogX" style="position: fixed;bottom: 80px;right: 100px;padding: 50px;background: #0ca;color: #fff;font-size: 16px;width: 600px;z-index:9999999"></div>');
$("body").append(logX);
function LogX(txt){
	logX.text(txt);
};

var getJD=function(){
	var str="省:"+DataGeoQQMap.shen_ok+"/"+DataGeoQQMap.shen_count;
	str+=" 市:"+DataGeoQQMap.si_ok+"/"+DataGeoQQMap.si_count;
	str+=" 区:"+DataGeoQQMap.qu_count;
	return " >>进度："+str;
};

var LoadNext=function(){
	if(StopLoad){
		//已停止
		if(StopLoad=="End"){
			console.warn("已手动当作完成");
			return endload();
		};
		console.error("已手动中断运行");
		return;
	};
	
	var hasItem=false;
	var findNext=function(childs,level,parent){
		if(level<3){
			for(var i=0;i<childs.length;i++){
				var o=childs[i];
				if(o.load==Load_Full_End){
					continue; //下级已全部加载完成
				}
				
				if(o.load==Load_Wait_Child){
					//看看下级有没有没处理的
					findNext(o.child,level+1,o);
				}else{
					//加载这个
					hasItem=true;
					LoadChild(o);
				};
				if(hasItem) return;
			};
		};
		if(parent){
			if(parent.load==Load_Wait_Child){
				DataGeoQQMap[Level[level-1].k+"_ok"]++;
			};
			parent.load=Load_Full_End;
		};
	};
	findNext(DataGeoQQMap.Root,1,null);
	if(hasItem) return;
	
	//没有数据，初始化加载省级
	if(!DataGeoQQMap.Root.length){
		LoadChild(null);
		return;
	};
	
	//已全部加载完成
	endload();
};

LoadNext();
})(); //@ sourceURL=console.js
