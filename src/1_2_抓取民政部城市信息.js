/*
2025-12-11最后找到的数据链接 https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html，由于没有更新的数据，忽略本步骤，本代码保留着
2026-04-03
	民政部说明：https://www.mca.gov.cn/n156/n186/index.html
		“按照《行政区划代码管理办法》相关规定，国务院民政部门应当在每年1月通过国家地名信息库发布截至上一年度末全国各级行政区划建制的行政区划代码信息。自2026年起，本栏目不再公布行政区划代码相关信息。请前往民政部门户网站首页的国家地名信息库版块查询相关信息。”
	国家地名信息库：https://dmfw.mca.gov.cn/


请忽略本步骤









获取民政部信息辅助补全

在以下页面执行
https://www.mca.gov.cn/n156/n2679/index.html 中打开最新行政区划代码链接
			老版本的链接在 https://www.mca.gov.cn/n156/n186/index.html

先加载jQuery
var s=document.createElement("script");
s.src="https://cdn.bootcdn.net/ajax/libs/jquery/1.9.1/jquery.min.js";
document.body.append(s);
*/
"use strict";
jQuery;

var SaveName="Step1_2_MCA"


//*******生成民政部数据*******
var allTxt=$("body").text();//html格式分析，no！
var exp=/\n[^\S\n]*(\d+)[^\S\n]*\n[^\S\n]*(.+?)[^\S\n]*\n/g;
var m;
var data={};
var arr=[];
while(m=exp.exec(allTxt)){
	var xjs=/\*$/.test(m[2]); //省直辖县级行政单位，县级市（如潜江市） 不包括直筒子市（如东莞市）
	var o={
		name: m[2].replace(/\*$/g,"")
		,code: m[1]
		,child: []
	};
	if(xjs) o.xjs=1;
	o.code=o.code.replace(/(0000|00)$/,"");
	data[o.code]=o;
	arr.push(o);
};
if(arr[0].name!="北京市" || arr[arr.length-1].code!="82"){
	console.log(arr);
	throw new Error("首尾数据不是预期城市");
};
console.log("读取到"+arr.length+"条数据", arr);

//人工修正数据，有些直辖市mca没有上级，补齐
var fixParent={
	1101:{name:"北京市"}
	,1201:{name:"天津市"}
	,3101:{name:"上海市"}
	,5001:{name:"重庆城区"}
	,5002:{name:"重庆郊县"}
};
//人工修正数据，移除单独没有下级数据的港澳台
var fixRemove={
	71:{name:"台湾省"}
	,81:{name:"香港特别行政区"}
	,82:{name:"澳门特别行政区"}
};
//构造成统一格式
var list=[];
for(var i=0;i<arr.length;i++){
	var o=arr[i];
	if(o.code.length==2){
		list.push(o);
	}else{
		var pid="";
		if(o.xjs){
			if(/^(\d\d)90/.test(o.code)){
				pid=RegExp.$1;
			}else{
				console.error(o);
				throw new Error("未适配的县级市编号");
			}
		}else if(o.code.length==4){
			pid=o.code.substr(0,2);
		}else if(o.code.length==6){
			pid=o.code.substr(0,4);
		}else{
			console.error(o);
			throw new Error("不能处理的编号");
		};
		
		var parent=data[pid];
		if(!parent){
			parent=fixParent[pid];
			if(parent){
				if(!parent.code){
					parent.code=pid;
					parent.child=[];
					data[pid.substr(0,pid.length-2)].child.push(parent);
				};
			};
		};
		if(!parent){
			console.error(o);
			throw new Error("没有上级，请添加fixParent");
		};
		parent.child.push(o);
	};
};
console.log("民政部数据准备完成",list);



/****格式化数据*****/
var format=function(arr,deep){
	var rtv=[];
	for(var i=0;i<arr.length;i++){
		var oi=arr[i];
		if(fixRemove[oi.code]){
			console.log("移除一项", oi);
			continue;
		}
		var o={
			name:oi.name
			,code:(oi.code+"000000000000").substr(0,12)
			,child:[]
		};
		rtv.push(o);
		
		if(deep!=2){
			if(oi.child.length==0){
				console.log(deep+" 缺失下级，用自身补齐",oi);
				oi.child.push({
					name:oi.name
					,code:oi.code
					,child:[]
				});
			};
			
			if(oi.child.length!=0){
				o.child=format(oi.child,deep+1);
			};
		}else if(oi.child.length>0){
			console.error(o);
			throw new Error("多余的下级数据");
		};
	};
	rtv.sort(function(a,b){
		return a.code.localeCompare(b.code);
	});
	return rtv;
};
var cityList=format(list,0);
console.log(cityList);

var url=URL.createObjectURL(
	new Blob([
		new Uint8Array([0xEF,0xBB,0xBF])
		,"var "+SaveName+"="
		,JSON.stringify({
			srcUrl:location.href||""
			,srcRef:document.referrer||""
			,cityList:cityList
		},null,"\t")
	]
	,{"type":"text/plain"})
);
var downA=document.createElement("A");
downA.innerHTML="下载合并好的数据文件";
downA.href=url;
downA.download=SaveName+".txt";
downA.click();

console.log("--完成--");