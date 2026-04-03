/*
获取高德地图城市数据
2026-04-03 高德地图乡镇级没有提供编号，乡镇编号可以从第1步得到的国家地名信息库数据中得到大部分乡镇编号。
	以前老版本注解：只需一次性获得省市区三级即可，乡镇这一级高德没有给出编码，因此放弃全使用高德数据，仅用来验证。（老版本）

在以下页面执行
https://lbs.amap.com/api/webservice/guide/api/district
*/
(function(){
"use strict";

var SaveName="Step1_3_Amap";
window.AMapReqCache=window.AMapReqCache||{}; //请求缓存数据，重新执行不需要重复请求
var DATA={time:new Date().toLocaleDateString(),cityList:[]};
AMapReqCache.DATA=DATA;


//获取所有省级
var load_shen_all=function(){
	DATA.cityList=[];
	var success=function(data){
		console.log("省级响应结果",data);
			
		if(data.districts.length!=1){
			console.error("结果不是唯一的");
			return;
		};
		
		var list=data.districts[0].districts;
		for(var i=0;i<list.length;i++){
			var o=list[i];
			if(o.level!="province") return console.error("省级数据级别不正确", o);
			DATA.cityList.push({
				name:o.name, code:o.adcode, child:null
			});
		}
		DATA.cityList.sort(function(a,b){ return a.code-b.code; });
		
		loadNextChild(0);
	};
	if(AMapReqCache.shen_all){
		success(JSON.parse(AMapReqCache.shen_all));
		return;
	};
	$.ajax({
		url:"https://lbs.amap.com/service/api/restapi?keywords=中国&subdistrict=1&extensions=base"
		,method:"POST"
		,data:{type:"config/district",version:"v3"}
		,dataType:"json"
		,error:function(){
			console.error("请求省级数据出错");
		}
		,success:function(data){
			if(data.infocode!="10000") return console.error("省级状态码错误", data);
			AMapReqCache.shen_all=JSON.stringify(data);
			success(data);
		}
	});
};

//加载下一个省份的数据
var loadNextChild=function(tryCount){
	var city=null;
	for(var i=0;i<DATA.cityList.length;i++){
		var o=DATA.cityList[i];
		if(!o.child){ city=o; break; }
	}
	if(!city) return load_end(); //全部加载完成，结束
	
	var tryLoad=function(err,data){
		if(tryCount>3) throw new Error("请求尝试次数超过限制，请重新执行");
		console.error("请求"+city.name+"数据出错，3秒后"+(tryCount+1)+"次重试："+err, data, city);
		setTimeout(function(){
			loadNextChild(tryCount+1);
		}, 3000);
	};
	var success=function(data){
		console.log("加载到"+city.name+"数据", data, city);	
		if(data.districts.length!=1){
			console.error("结果不是唯一的");
			return;
		};
		var code0=data.districts[0].adcode;
		if(code0!=city.code){
			console.error("结果的adcode"+code0+"和"+city.code+"不一致");
			return;
		};
		
		addChild(2, city, data.districts[0].districts);
		loadNextChild(0);
	};
	
	if(AMapReqCache[city.code]){
		success(JSON.parse(AMapReqCache[city.code]));
		return;
	};
	$.ajax({
		url:"https://lbs.amap.com/service/api/restapi?keywords="+city.name+"&subdistrict=3&extensions=base"
		,method:"POST"
		,data:{type:"config/district",version:"v3"}
		,dataType:"json"
		,error:function(e){
			tryLoad("请求出错",e);
		}
		,success:function(data){
			if(data.infocode!="10000") return tryLoad("状态码错误", data);
			AMapReqCache[city.code]=JSON.stringify(data);
			success(data);
		}
	});
};
var addChild=function(level, parent, list){
	parent.child=[];
	if(!list || list.length==0) return console.warn(parent.name+"没有子级数据", parent);
	var Level={
		province:1
		,city:2
		,district:3
		,street:4
	};
	var item0=list[0], level0=Level[item0.level]||999;
	if(level0!=level){
		if(level0!=level+1){ throw new Error("和上级发生了多级跨级"); }
		//和上级之间跨越了一级，3级变成了4级
		console.log(parent.name+"和下级之间发生跨级，简单复制自身补齐，code完全相同，下级数据已变成第"+(level+1)+"级");
		while(true){
			var copy={
				name:parent.name
				,code:parent.code
				,child:[]
			};
			parent.child.push(copy);
			
			level=level+1;
			parent=copy;
			
			if(level==3 && (parent.code=="810000" || parent.code=="820000")){
				console.log(parent.name+"再复制一级，下级数据已变成第"+(level+1)+"级");
				continue;
			};
			break;
		};
	};
	
	for(var i=0;i<list.length;i++){
		var o=list[i];
		if(o.level!=item0.level){ console.error("级别和同级数据不一致", o); throw new Error(); }
		var itm={ name:o.name ,code:o.adcode };
		if(level0==4){
			if(itm.code!=parent.code) throw new Error("似乎乡镇级已经提供了编号，请删除这行代码");
			itm.code="";
		}else if(itm.code==parent.code){
			console.error("不应该出现的和上级id相同数据", o); throw new Error();
		}else if(itm.code.indexOf(parent.code.replace(/(00|0000)$/g,""))!=0){
			console.error("不应该出现的和上级id关系不一致", o); throw new Error();
		};
		parent.child.push(itm);
		if(level!=4){
			addChild(level+1, itm, o.districts);
		}
	};
	parent.child.sort(function(a,b){ return a.code-b.code||a.name.localeCompare(b.name) });
};

var load_end=function(){
	var setVal=function(list){
		if(!list || list.length==0) return;
		for(var i=0;i<list.length;i++){
			var o=list[i];
			if(o.code) o.code=(o.code+"000000000000").substr(0,12);
			setVal(o.child);
		}
	};
	setVal(DATA.cityList);
	
	var url=URL.createObjectURL(
		new Blob([
			new Uint8Array([0xEF,0xBB,0xBF])
			,"var "+SaveName+"="
			,JSON.stringify(DATA,null,"\t")
		]
		,{"type":"text/plain"})
	);
	var downA=document.createElement("A");
	downA.innerHTML="下载合并好的数据文件";
	downA.href=url;
	downA.download=SaveName+".txt";
	downA.click();

	console.log("--完成--", DATA);
};

load_shen_all();
})();//@ sourceURL=console.js