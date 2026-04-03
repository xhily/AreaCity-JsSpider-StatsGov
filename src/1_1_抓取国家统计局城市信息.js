/*
获取国家地名信息库所有城市名称原始数据
2026-04-03 民政部说明：https://www.mca.gov.cn/n156/n186/index.html “请前往民政部门户网站首页的国家地名信息库版块查询相关信息”
	以前老版本注解：统计局自2024年下半年起就不再公开统计用区划代码，链接已经找不到了，老版本使用链接（无法访问）https://www.stats.gov.cn/sj/tjbz/qhdm/
	

在以下页面执行
	https://dmfw.mca.gov.cn/interface.html
*/
(function(){
"use strict";

var SaveName="Step1_1_DmfwMcaGov";
window.DmfwReqCache=window.DmfwReqCache||{loadCount:0,blockCount:0}; //请求缓存数据，重新执行不需要重复请求
var DATA={ver:"",cityList:[]};
DmfwReqCache.DATA=DATA;

var logX=$('<div class="LogX" style="position: fixed;bottom: 80px;right: 100px;padding: 50px;background: #0ca;color: #fff;font-size: 16px;width: 600px;z-index:9999999"></div>');
$("body").append(logX);
function LogX(txt){
	logX.text(txt);
};

//获取版本号，数据发布时间
var load_ver=function(){
	LogX("加载版本号...");
	var success=function(html){
		var m=/数据截止日期为(\d+)年(\d+)月(\d+)日/.exec(html);
		if(!m) return console.error("请求发布时间数据文本中未找到日期", {data:html});
		DATA.ver=m[1]+"-"+m[2]+"-"+m[3];
		console.log("数据发布时间："+DATA.ver);
		load_shen_all();
	};
	if(DmfwReqCache.ver_html){
		success(DmfwReqCache.ver_html);
		return;
	};
	$.ajax({
		url:"/XzqhVersionPublish.html"
		,method:"GET"
		,error:function(){
			console.error("请求发布时间数据出错");
		}
		,success:function(data){
			if(data.indexOf("四级行政区划建制的行政区划代码。数据截止日期为")==-1) return console.error("请求发布时间数据文本未匹配", {data:data});
			DmfwReqCache.ver_html=data;
			success(data);
		}
	});
};

//获取所有省级，同时会拿到所有市级
var load_shen_all=function(){
	LogX("加载所有省级+市级...");
	DATA.cityList=[];
	var success=function(data){
		console.log("省级响应结果",data);
			
		if(data.data.children.length!=34){
			console.error("结果数量不是34");
			return;
		};
		
		var list=data.data.children;
		for(var i=0;i<list.length;i++){
			var o=list[i];
			if(o.name=="香港特别行政区" || o.name=="澳门特别行政区" || o.name=="台湾省"){
				console.warn(o.name+"没有数据（请点开对象确认）", o);
				continue; //跳过不处理
			};
			if(o.level!=1) return console.error("省级数据级别不正确", o);
			if(o.code.length!=12) return console.error("不应该出现的id长度不是12", o);
			var item={ name:o.name, code:o.code, child:[] };
			DATA.cityList.push(item);
			
			var clist=o.children;
			//检查下级是否全部是区县级（直辖市）
			var allQX=true;
			for(var j=0;j<clist.length;j++){
				var o2=clist[j];
				if(o2.level==2){ allQX=false; break; }
			}
			if(allQX){
				if(/^(11|12|31|50)/.test(o.code)){
					//直辖市，复制一层相同的
					console.log(o.name+" 直辖市，复制自身补齐一层");
					zxsIds[o.code]=1;
					var item2={ name:o.name, code:o.code, child:[] };
					item.child.push(item2);
					item=item2;
				}else{
					return console.error("未知直辖市，下级全是区县", o);
				}
			};
			//拿到市级
			for(var j=0;j<clist.length;j++){
				var o2=clist[j];
				if(o2.code.length!=12) return console.error("不应该出现的id长度不是12", o2);
				item.child.push({ name:o2.name, code:o2.code, child:null });
			};
			item.child.sort(function(a,b){ return a.code-b.code; });
		}
		DATA.cityList.sort(function(a,b){ return a.code-b.code; });
		
		loadNextChild(0);
	};
	if(DmfwReqCache.shen_all){
		success(JSON.parse(DmfwReqCache.shen_all));
		return;
	};
	$.ajax({
		url:"https://dmfw.mca.gov.cn/9095/xzqh/getList?maxLevel=2"
		,method:"GET"
		,error:function(){
			console.error("请求省级数据出错");
		}
		,success:function(data){
			if(data.status!=200) return console.error("省级状态码错误", data);
			DmfwReqCache.shen_all=JSON.stringify(data);
			success(data);
		}
	});
};
var zxsIds={};

//加载下一个市级的数据
var loadNextChild=function(tryCount){
	var city=null, pCity=null, pIdx=0, cIdx=0;
	for(var i=0;i<DATA.cityList.length;i++){
		var o=DATA.cityList[i];
		if(zxsIds[o.code]){
			o=o.child[0]; //直辖市，取区县级去读取数据
		};
		for(var j=0;j<o.child.length;j++){
			var o2=o.child[j];
			if(!o2.child){ city=o2; pCity=o; pIdx=i; cIdx=j; break; }
		}
		if(city) break;
	}
	if(!city) return load_end(); //全部加载完成，结束
	
	var tryLoad=function(err,data){
		if(tryCount>3) throw new Error("请求尝试次数超过限制，请重新执行");
		if(/接口调用过于频繁/.test(data.message)){
			DmfwReqCache.blockCount++;
		}else{
			console.error("请求"+pCity.name+"-"+city.name+"数据出错，3秒后"+(tryCount+1)+"次重试："+err, data, city, pCity);
		}
		updateStatus("3秒后"+(tryCount+1)+"次重试："+err);
		setTimeout(function(){
			loadNextChild(tryCount+1);
		}, 3000);
	};
	var success=function(data){
		//console.log("加载到"+pCity.name+"-"+city.name+"数据", data, city, pCity);
		var code0=data.data.code;
		if(code0!=city.code){
			console.error("结果的code"+code0+"和"+city.code+"不一致");
			return;
		};
		
		var level=3;
		if(zxsIds[pCity.code]) level=4;
		addChild(level, city, data.data.children);
		loadNextChild(0);
	};
	
	var updateStatus=function(msg){
		var logMsg=(pIdx+1)+"/"+(DATA.cityList.length)+" "+pCity.name+" - "+(cIdx+1)+"/"+pCity.child.length+" "+city.name+" ...";
		LogX("加载"+DmfwReqCache.loadCount+"次 block:"+DmfwReqCache.blockCount+" | "+logMsg+(msg?" | "+msg:""));
	};
	if(DmfwReqCache[city.code]){
		updateStatus();
		success(JSON.parse(DmfwReqCache[city.code]));
		return;
	};
	DmfwReqCache.loadCount++;
	updateStatus();
	$.ajax({
		url:"https://dmfw.mca.gov.cn/9095/xzqh/getList?maxLevel=2&code="+city.code
		,method:"GET"
		,error:function(e){
			tryLoad("请求出错",e);
		}
		,success:function(data){
			if(data.status!=200) return tryLoad("状态码错误["+data.status+"]："+data.message, data);
			DmfwReqCache[city.code]=JSON.stringify(data);
			success(data);
		}
	});
};
var addChild=function(level, parent, list){
	parent.child=[];
	if(!list || list.length==0) return console.warn(parent.name+"没有子级数据", parent);
	var item0=list[0], level0=item0.level||999;
	if(level0!=level){
		if(level0!=level+1){ throw new Error("和上级发生了多级跨级"); }
		//和上级之间跨越了一级，3级变成了4级
		console.log(parent.name+"和下级之间发生跨级，简单复制自身补齐，code完全相同，下级数据已变成第"+(level+1)+"级");
		var copy={
			name:parent.name
			,code:parent.code
			,child:[]
		};
		parent.child.push(copy);
		
		level=level+1;
		parent=copy;
	};
	
	for(var i=0;i<list.length;i++){
		var o=list[i];
		if(o.level!=item0.level){ console.error("级别和同级数据不一致", o); throw new Error(); }
		var itm={ name:o.name ,code:o.code };
		if(itm.code.indexOf(parent.code.replace(/(000|000000|00000000)$/g,""))!=0){
			console.error("不应该出现的和上级id关系不一致", o); throw new Error();
		};
		if(itm.code.length!=12){
			console.error("不应该出现的id长度不是12", o); throw new Error();
		};
		parent.child.push(itm);
		if(level!=4){
			addChild(level+1, itm, o.children);
		}
	};
	parent.child.sort(function(a,b){ return a.code-b.code });
};

var load_end=function(){
	LogX("完成");
	
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

load_ver();
})();//@ sourceURL=console.js