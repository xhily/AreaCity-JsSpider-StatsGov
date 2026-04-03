/*
生成最终城市列表
2026-04-03 统计局自2024年下半年起就不再公开统计用区划代码、民政部自2026年起不再公布行政区划代码相关信息，改用国家地名信息库数据。
	高德地图乡镇级没有提供编号，乡镇编号可以从地名信息库数据中得到大部分乡镇编号。
	腾讯地图数据（20240814之后的版本）乡镇级存在很多和上级不一致的自定义编号，难以处理，新版本中此数据将仅用来做辅助和验证用。
	以前老版本注解：使用统计局+民政部的数据，和高德地图的数据，对腾讯地图的数据进行校验修正。最终得到前三级以统计局为准，综合民政部、高德、腾讯地图的数据；第四级采用腾讯地图的数据。（老版本）

合并结果：
1. 省市区三级使用高德地图数据
2. 乡镇级使用国家地名信息库数据，极少部分手动替换成腾讯地图数据
3. 从腾讯地图数据中提取部分拼音信息

加载数据
	var url="https://地址/";
	var s=document.createElement("script");s.src=url+"Step1_1_DmfwMcaGov.txt?t="+Date.now();document.documentElement.appendChild(s);
	var s=document.createElement("script");s.src=url+"Step1_3_Amap.txt?t="+Date.now();document.documentElement.appendChild(s);
	var s=document.createElement("script");s.src=url+"Step1_4_QQmap.txt?t="+Date.now();document.documentElement.appendChild(s);
	var s=document.createElement("script");s.src=url+"../../1_5_合并_替换数据.txt?t="+Date.now();document.documentElement.appendChild(s);
*/
"use strict";

var SaveName="Step1_5_Merge_All";
var GovSaveName="Step1_1_DmfwMcaGov";
var AmapSaveName="Step1_3_Amap";
var QQmapSaveName="Step1_4_QQmap";
var S5ReplaceListName="Step1_5_ReplaceList";


//高德结果需要添加的项目
var Fix_Add={
	653223:{ level:3,name:"皮山县",addChild:[ { code:"653223102",name:"赛图拉镇"} ]} //新疆和田 新设立[和康县] 赛图拉镇更名为昆岭镇，高德目前暂无[和康县 和安县]，恢复成之前的老数据
};
//高德结果需要替换的项目
var Fix_Replace={
	632825:{ code:"632825",level:3,name:"大柴旦行政委员会",name2:"海西蒙古族藏族自治州直辖",child:[ //gov没有，高德是“海西蒙古族藏族自治州直辖”，QQ编号632857，下级采用QQ的3位编号
			 {code:"632825100", name:"柴旦镇"}
			,{code:"632825101", name:"锡铁山镇"}
		]}
	,232718:{ code:"232761",level:3,name:"加格达奇区",name2:"加格达奇区",child:[ //gov没有，高德是232718，QQ是232761，QQ的是对的（老版本）
			{name:"卫东街道",code:"232761002"},
			{name:"红旗街道",code:"232761003"},
			{name:"曙光街道",code:"232761005"},
			{name:"光明街道",code:"232761006"},
			  {name:"东山镇",code:"232761100"},
			  {name:"长虹镇",code:"232761101"},
			  {name:"加北乡",code:"232761200"},
			  {name:"白桦乡",code:"232761201"}
		]}
};
//高德结果中需要移除的项目
var Fix_Remove={
	440499:{ level:3,name:"澳门大学横琴校区(由澳门实施管辖)" }
};



if(!window[GovSaveName]){
	throw new Error("需加载"+GovSaveName);
};
if(!window[AmapSaveName]){
	throw new Error("需加载"+AmapSaveName);
};
if(!window[QQmapSaveName]){
	throw new Error("需加载"+QQmapSaveName);
};
if(!window[S5ReplaceListName]){
	throw new Error("需加载"+S5ReplaceListName);
};
var s5ReplaceList=JSON.parse(JSON.stringify(window[S5ReplaceListName]));
var govData=JSON.parse(JSON.stringify(window[GovSaveName]));
var amapData=JSON.parse(JSON.stringify(window[AmapSaveName]));
var qqmapData=JSON.parse(JSON.stringify(window[QQmapSaveName]));


function SCode(itm,level){
	if(level==null){
		level=1;
		var cur=itm,p=cur.parent;
		while(p){
			if(p.code!=cur.code || p.name!=cur.name){
				level++;
			};
			cur=p;
			p=cur.parent;
		};
	};
	
	var exp="000000";
	if(level<3){
		exp+="|00000000";
	};
	if(level<2){
		exp+="|0000000000";
	};
	return itm.code.replace(new RegExp("("+exp+")$"),"");
};
function FCode(code){
	return (code+"000000000000").substr(0,12);
};
var setParent=function(p,level,mp,arr){
	for(var i=0;i<arr.length;i++){
		var itm=arr[i];
		if(itm.code) mp[itm.code]=itm;
		itm.parent=p;
		itm.level=level;
		if(itm.child && itm.child.length)setParent(itm,level+1,mp,itm.child);
	};
	return mp;
};
var govDataMP, amapDataMP, qqmapDataMP;
var resetParentMP=function(){
	govDataMP=setParent(null,1,{},govData.cityList);
	amapDataMP=setParent(null,1,{},amapData.cityList);
	qqmapDataMP=setParent(null,1,{},qqmapData.cityList);
};

//北京 天津 上海 直辖市统一处理，第二级统一用相同01编号，gov、qq都没有提供第二级，但区级里面都是用的01编号
//	注：县级市、不设区的直筒子市 的区级都是直接复制的一份上级，区级为00 无需处理
console.log("\n【·】直辖市统一处理>>>>>>>>>>");
var splitZxs=function(tag, data){
	var list0=data.cityList;
	for(var i=0;i<list0.length;i++){
		var item0=list0[i], list2=item0.child;
		if(/^(11|12|31)/.test(item0.code)){
			if(list2.length!=1){ console.error("直辖市子级不是1个", item0); throw new Error(); }
			var item2=list2[0], code=item0.code.replace(/^(\d\d)(00)/,"$1"+"01");
			if(code==item0.code) throw new Error("直辖市code无效 "+code);
			if(item2.code!=code){
				console.log("        "+tag+"已将"+item0.name+"的code "+item2.code+"改成"+code);
				item2.code=code;
			}else if(item2.name!=item0.name){
				console.log("        "+tag+"已将"+item0.name+"的name "+item2.name+"改成"+item0.name);
				item2.name=item0.name;
			}else{
				console.error("直辖市第二级内容不匹配", item2); throw new Error();
			}
		}
	}
};
splitZxs("gov", govData);
splitZxs("腾讯地图", qqmapData);
splitZxs("高德地图", amapData);

//重庆数据区县级几个数据都是5001 5002，但上级没有统一的，固定按高德的 城区 郊县 统一处理
console.log("\n【·】重庆数据统一处理>>>>>>>>>>");
var splitCQ=function(tag, data){
	var list0=data.cityList, item0=null;
	for(var i=0;i<list0.length;i++) if(/^50/.test(list0[i].code)) item0=list0[i];
	var list1Old=item0.child;
	var list1New=item0.child=[
		{name:"重庆城区",code:"500100000000",child:[]}
		,{name:"重庆郊县",code:"500200000000",child:[]}
	];
	if(list1Old.length!=1) throw new Error(tag+"的重庆市下级不是1个数据");
	var list2=list1Old[0].child;
	for(var i=0;i<list2.length;i++){
		var o=list2[i];
		if(/^5001/.test(o.code)){
			list1New[0].child.push(o);
		}else if(/^5002/.test(o.code)){
			list1New[1].child.push(o);
		}else{
			console.error(tag+"的重庆市下级存在未知编号", o); throw new Error();
		}
	}
	console.log("        "+tag+"已处理");
};
splitCQ("gov", govData);
splitCQ("腾讯地图", qqmapData);


//gov乡镇级数据里面有名字带了撤销的，清除掉
console.log("\n【·】清除gov撤销的乡镇>>>>>>>>>>");
var clearGov=function(level, store, list){
	if(!list || !list.length)return;
	for(var i=0;i<list.length;i++){
		var o=list[i];
		if(level==4){
			if(/（.*撤[销分].*）/.test(o.name)){
				list.splice(i, 1); i--;
				store.push(o);
			}
		}else{
			clearGov(level+1, store, o.child);
		}
	}
	if(level==1){
		console.log("        已清除"+store.length+"个撤销", store);
	}
};
clearGov(1, [], govData.cityList);


console.log("\n【·】统计几个地图差异>>>>>>>>>>");
var compareLevelAll=function(tagA, tagB, level, scope, arrA, arrB){
	if(level==1){
		scope.diffA1=[]; scope.diffA2=[]; scope.diffA3=[]; scope.diffA4=[];
		scope.diffB1=[]; scope.diffB2=[]; scope.diffB3=[]; scope.diffB4=[];
	}
	var mpA={}, mpB={}, mpAN={}, mpBN={};
	for(var i=0;i<arrA.length;i++){
		var o=arrA[i];
		if(!/^(71|81|82)/.test(o.code)){ mpA[o.code]=mpAN[o.name]={o:o}; }
	}
	for(var i=0;i<arrB.length;i++){
		var o=arrB[i];
		if(!/^(71|81|82)/.test(o.code)){ mpB[o.code]=mpBN[o.name]={o:o}; }
	}
	//标记相同的
	for(var i=0;i<arrB.length;i++){
		var o=arrB[i], oA=o.code?mpA[o.code]:null, oB=o.code?mpB[o.code]:mpBN[o.name];
		if((scope.allowName || level==4) && !oA) oA=mpAN[o.name]; //明确要求 或者 乡镇级，才用名称匹配
		if(oA&&oB){ oA.find=oB; oB.find=oA; }
	}
	//拿到差异
	for(var k in mpA){
		var o=mpA[k];
		if(!o.find){
			scope["diffA"+level].push(o.o);
		}
	}
	for(var k in mpB){
		var o=mpB[k];
		if(!o.find){
			scope["diffB"+level].push(o.o);
		}else if(level<4){
			var childA=o.find.o.child||[];
			var childB=o.o.child||[];
			compareLevelAll(tagA, tagB, level+1, scope, childA, childB);
		}
	}
	//打印对比结果
	if(level==1){
		console.log("        ===== "+tagA+"和"+tagB+"差异 =====");
		console.log("        "+tagA+"未匹配 "+scope.diffA1.length+" "+scope.diffA2.length+" "+scope.diffA3.length+" "+scope.diffA4.length
			, scope.diffA1, scope.diffA2, scope.diffA3, scope.diffA4);
		console.log("        "+tagB+"未匹配 "+scope.diffB1.length+" "+scope.diffB2.length+" "+scope.diffB3.length+" "+scope.diffB4.length
			, scope.diffB1, scope.diffB2, scope.diffB3, scope.diffB4);
	}
};
compareLevelAll("gov","高德地图", 1, {}, govData.cityList, amapData.cityList);
compareLevelAll("gov","腾讯地图", 1, {allowName:true}, govData.cityList, qqmapData.cityList);
compareLevelAll("高德地图","腾讯地图", 1, {allowName:true}, amapData.cityList, qqmapData.cityList);


//乡镇数据采用gov的全部数据，替换掉高德能匹配的区县级下级
console.log("\n【·】填充gov乡镇级数据到高德数据中>>>>>>>>>>");
resetParentMP();
var noSet=[];
for(var i0=0;i0<amapData.cityList.length;i0++){
	var item0=amapData.cityList[i0];
	for(var i1=0;i1<item0.child.length;i1++){
		var item1=item0.child[i1];
		for(var i2=0;i2<item1.child.length;i2++){
			var item2=item1.child[i2];
			var itemGov=govDataMP[item2.code];
			if(itemGov){
				item2.child=itemGov.child;
			}else{
				noSet.push(item2);
			}
		}
	};
};
console.log("        未填充"+noSet.length+"个区县", noSet);


console.log("\n【·】手动修正数据处理>>>>>>>>>>");
resetParentMP();
for(var code in Fix_Remove){
	var fix=Fix_Remove[code], item=amapDataMP[FCode(code)];
	if(!item){ console.error("Fix_Remove "+code+" 未在amap数据中找到", fix); throw new Error() }
	if(fix.level!=item.level || fix.name!=item.name){ console.error("Fix_Remove "+code+" 和amp数据不匹配", fix, item); throw new Error() }
	var list=item.parent.child;
	for(var i=0;i<list.length;i++){
		var o=list[i];
		if(o.code==item.code){
			list.splice(i,1);i--;
			console.log("        已删除 "+item.parent.name+"-"+item.name);
		}
	}
}
resetParentMP();
for(var code in Fix_Add){
	var fix=Fix_Add[code], item=amapDataMP[FCode(code)];
	if(!item){ console.error("Fix_Add "+code+" 未在amap数据中找到", fix); throw new Error() }
	if(fix.level!=item.level || fix.name!=item.name){ console.error("Fix_Add "+code+" 和amp数据不匹配", fix, item); throw new Error() }
	for(var i=0;i<fix.addChild.length;i++){
		var o=fix.addChild[i];
		var exists=amapDataMP[FCode(o.code)];
		if(exists){ console.error("Fix_Add "+code+" 项已在amap数据中存在", o, exists); throw new Error() }
		item.child.push(o);
		console.log("        已添加 "+item.name+"-"+o.name);
	}
}
resetParentMP();
for(var code in Fix_Replace){
	var fix=Fix_Replace[code], item=amapDataMP[FCode(code)];
	if(!item){ console.error("Fix_Replace "+code+" 未在amap数据中找到", fix); throw new Error() }
	if(fix.level!=item.level || fix.name2!=item.name){ console.error("Fix_Replace "+code+" 和amp数据不匹配", fix, item); throw new Error() }
	
	item.code=fix.code; item.name=fix.name; item.child=fix.child;
	console.log("        已替换 "+item.parent.name+"-"+fix.name2+"["+code+"]"+" 成 "+item.name+"["+item.code+"]", item);
}
resetParentMP();
for(var i0=0;i0<s5ReplaceList.length;i0++){
	var fix=s5ReplaceList[i0], item=amapDataMP[FCode(fix.code)];
	while(item && item.level!=fix.level) item=item.parent; var code=fix.code;
	if(!item){ console.error("s5ReplaceList "+code+" 未在amap数据中找到", fix); throw new Error() }
	if(fix.level!=item.level || fix.name2!=item.name){ console.error("s5ReplaceList "+code+" 和amp数据不匹配", fix, item); throw new Error() }
	
	item.code=fix.code; item.name=fix.name; item.child=fix.child; if(fix.qqPY)item.qqPY=fix.qqPY;
	console.log("        已替换 "+fix.name2+"["+code+"]"+" 成 "+item.name+"["+item.code+"]", item);
}



console.log("\n【·】导出>>>>>>>>>>");
resetParentMP();
var format=function(src,level){
	var dist=[];
	for(var i=0;i<src.length;i++){
		var o=src[i];
		var itm={
			name:o.name
			,code:FCode(o.code)
		};
		if(+itm.code<1){ console.error("没有id", o); throw new Error(); }
		var qqItem=qqmapDataMP[itm.code];
		if(qqItem && qqItem.qqPY) itm.qqPY=qqItem.qqPY; //先用QQ的拼音
		if(o.qqPY)itm.qqPY=o.qqPY;
		dist.push(itm);
		
		if(level<4){
			if(!o.child || o.child.length==0){
				if(o.code.indexOf("71")!=0){//台湾明确缺失第4级就不提示了
					console.log(level+":"+o.code+":"+o.name+"缺失下级，用自身补齐",o);
				};
				o.child=[JSON.parse(JSON.stringify(itm))];
			};
			
			itm.child=format(o.child,level+1);
		};
	};
	dist.sort(function(a,b){
		return a.code.localeCompare(b.code);
	});
	return dist;
};
var data=format(amapData.cityList,1);

var saveData={
	govVer:govData.ver
	,qqVer:qqmapData.ver
	,amapTime:amapData.time
	,cityList:data
};
window[SaveName]=saveData;

var url=URL.createObjectURL(
	new Blob([
		new Uint8Array([0xEF,0xBB,0xBF])
		,"var "+SaveName+"="
		,JSON.stringify(saveData,null,"\t")
	]
	,{"type":"text/plain"})
);
var downA=document.createElement("A");
downA.innerHTML="下载合并好城市的文件";
downA.href=url;
downA.download=SaveName+".txt";
downA.click();

console.log("--完成--");


//@ sourceURL=console.js
