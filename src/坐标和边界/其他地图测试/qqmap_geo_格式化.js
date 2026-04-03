/*
【测试用】
导出腾讯地图省市区三级坐标和行政区域边界为csv格式。

在【AreaCity Geo格式转换工具】中执行
	打开工具，点开高级，然后脚本区域粘贴本代码进去，点击应用，根据提示进行操作即可
*/
(function(){
if(!("geometryCalc" in (window.AppCmds||{}))){
	throw new Error(window.AppCmds? "软件版本过低，请重新下载升级后再操作" : "请使用【AreaCity Geo格式转换工具】运行本代码");
};

Runtime.Ctrls([
	{html:'<div>请点击下面选择文件来选择上一步得到的腾讯地图数据文件，然后点击“开始处理”按钮</div>\
		\
		<div style="padding-top:8px">\
			<button onclick="choiceDataFileClick()">选择上一步的数据文件</button>\
			<input class="fmtIn in_dataFile" style="width:320px">\
		</div>\
	'}
	,{html:'<div style="padding-top:8px"></div>'}
	,{name:"开始处理",click:"runClick"}
]);
window.choiceDataFileClick=function(){
	var vals=readInVal();
	var val=AppCmds.fileChoice(vals.dataFile+"");
	if(!val)return;
	val=val.replace(/\\/g,"/");
	vals.dataFile=val;
	fillInVal(vals);
};

//输入框数据读写
var fillInVal=function(data){
	$(".fmtIn").each(function(k,v){
		var key=(/\bin_(\w+)/.exec(v.className)||[])[1];
		if(data[key]!=null)v.value=data[key];
	});
};
var readInVal=function(){
	var vals={};
	$(".fmtIn").each(function(k,v){
		var key=(/\bin_(\w+)/.exec(v.className)||[])[1];
		vals[key]=v.value.trim();
	});
	return vals;
};

//初始化界面
var storeKey="Store_QQMapGeoFmtJsSet";
var oldSet=ParseObject(ParseObject(AppCmds.config()).Input[storeKey]);
if(oldSet.dataFile){ //恢复之前的配置
	fillInVal(oldSet);
};

var runStartTime=0;
var runTimeTips=function(){
	var ms=Date.now()-runStartTime;
	ms=~~(ms/1000);
	var txt=("0"+ms%60).substr(-2)+"秒";
	txt=~~(ms/60)+"分"+txt;
	return txt
};

//执行
window.runClick=function(){
	runStartTime=Date.now();
	AppCmds.transformStart("腾讯地图数据格式化");
	var fRead,fWrite;
	var finalCall=function(){
		if(fRead) AppCmds.closeRes(fRead);
		if(fWrite) AppCmds.closeRes(fWrite);
		AppCmds.transformEnd();
	};
	var catchCall=function(e){
		finalCall();
		var tips="发生异常："+e.message;
		AppCmds.showTips(tips,true);Runtime.Log(tips,1);
	};
	
	try{
		var inArgs=readInVal(),inArgsRaw=JSON.stringify(inArgs),err="";
		var dataFile=inArgs.dataFile, saveFile=dataFile+"-"+Date.now()+".csv";
		if(!err&&!dataFile) err="请选择上一步的数据文件";
		if(err){
			finalCall();
			AppCmds.showTips(err,true);Runtime.Log(err,1);
			return;
		}
		Runtime.Log("配置："+JSON.stringify(inArgs));
		//存起来
		AppCmds.setConfig(storeKey,inArgsRaw);
		
		//打开文件
		fRead=AppCmds.openFileReadRes(dataFile);
		//写入文件
		fWrite=AppCmds.openFileWriteRes(saveFile);
		AppCmds.fileWrite(fWrite, 'id,pid,deep,name,ext_path,geo,polygon');
	}catch(e){
		catchCall(e);
		return;
	}
	
	var isStart=false, dataCount=0, lineNo=0;
	var readNextLine=function(){
		__readNextTime=Date.now();
		try{
			__readNextLine();
		}catch(e){
			catchCall(new Error("第"+lineNo+"行处理异常："+e.message));
		}
	};
	var __readNextTime=0;
	var __readNextLine=function(){
		while(true){
			//异步处理，避免大点的文件处理慢、卡界面
			if(Date.now()-__readNextTime>300){
				setTimeout(readNextLine);
				return;
			};
			
			var line=AppCmds.fileReadLine(fRead);
			if(line==null){
				//没有数据了
				if(isStart){
					throw new Error("未发现结束位置，可能文件已损坏");
				}
				break;
			};
			lineNo++;
			
			if(isStart && line.indexOf("]")==0){
				//处理完成所有数据
				break;
			}
			if(!isStart){
				//等待开始标志
				if(line.indexOf('var DATA_GEO_QQMap=[')==0){
					isStart=true;
				}else{
					Runtime.Log("读取到文件头部内容："+line,2);
				}
				continue;
			}
			
			line=/^,?(.+?),?$/.exec(line)[1];
			try{
				var item=JSON.parse(line);
			}catch(e){
				throw new Error("数据不能解析成json");
			}
			
			writeItem(item);
			dataCount++;
			AppCmds.showTips("处理中，"+dataCount+"条数据");
		};
		
		if(!isStart){
			catchCall(new Error("未识别到数据，请检查选择的文件是否正确"));
			return;
		}
					
		var tips="【处理完成】【耗时："+runTimeTips()+"】总计"+dataCount+"条数据，保存在："+saveFile;
		AppCmds.showTips(tips);Runtime.Log(tips,2);
		finalCall();
	};
	
	var writeItem=function(item){
		var polygon="EMPTY", wkts=item.wkts;
		if(wkts){
			var arr=wkts.split("|");
			if(arr.length>1){ //多个时，可能是孔洞 或者 飞地，计算后合并
				var fn="Intersects!?( Contains!?Difference:Throw_GeomCalcFail ):Union";
				try{
					var wkt=AppCmds.geometryCalc(fn, arr[0], arr.slice(1).join("|"));
					if(!AppCmds.geometryCalc("IsValid", wkt, null)){
						throw new Error("图形计算结果为无效");
					}
				}catch(e){
					var msg="第"+lineNo+"行图形计算异常："+e.message;
					for(var i=0;i<arr.length;i++){
						if(!AppCmds.geometryCalc("IsValid", arr[i], null)){
							msg+=" | 第"+(i+1)+"个环无效";
						}else{
							msg+=" | 第"+(i+1)+"个环有效";
						}
					}
					Runtime.Log(msg,1);
					return;
				}
				arr=[wkt];
			}
			polygon=WktToPolygon(arr[0]);
		};
		
		var str=SCode(item.code)+","+SCode(item.pCode)+","+(item.level-1);
		str+=","+CSVName(item.name)+","+CSVName(item.ext_path);
		str+=","+CSVName(item.geo)+","+CSVName(polygon);
		AppCmds.fileWrite(fWrite, "\n"+str);
	};
	
	readNextLine();
};

function SCode(code,level){
	var exp="000000";
	if(level<3){
		exp+="|00000000";
	};
	if(level<2){
		exp+="|0000000000";
	};
	if(!+code) return "0";
	return (code+"000000000000").substr(0,12).replace(new RegExp("("+exp+")$"),"");
};
var FixTrim=function(name){
	return name.replace(/^\s+|\s+$/g,"");
};
var CSVName=function(name){
	return '"'+FixTrim(name).replace(/"/g,'""')+'"';
};
var WktToPolygon=function(wkt){
	if(wkt.indexOf("POLYGON")==0){
		return parsePolygon(wkt.replace(/^POLYGON\s*\(\(|\)\)$/ig,""));
	}else if(wkt.indexOf("MULTIPOLYGON")==0){
		var vals=[];
		var ps=wkt.replace(/^MULTIPOLYGON\s*\(\(\(|\)\)\)$/ig,"").split(/\)\)\s*,\s*\(\(/g);
		for(var i2=0;i2<ps.length;i2++){
			vals.push(parsePolygon(ps[i2]));
		};
		//把坐标点最多的环排前面，免得每次采集结果不一样导致差异
		vals.sort(function(a,b){ return b.length-a.length; });
		return vals.join(";");
	}
	throw new Error("未知wkt格式");
};
var parsePolygon=function(polygon){
	var arr = polygon.split(/\)\s*,\s*\(/g);
	var vals = [];
	for (var i0 = 0, l0 = arr.length; i0 < l0; i0++) {
		var ps = arr[i0].split(/\s*,\s*/g);
		var pos = [];
		for (var j = 0, jl = ps.length; j < jl; j++) {
			var v=ps[j].split(" ");
			//pos.push([+(+v[0]).toFixed(6), +(+v[1]).toFixed(6)]);
			pos.push([+v[0], +v[1]]);
		}
		//删除重复的点，包括首尾闭合的点
		for(var i=0;i<pos.length;i++){
			var p=pos[i],p2=pos[i+1]||pos[0];
			if(p[0]==p2[0] && p[1]==p2[1]){
				pos.splice(i,1); i--;
			}
		}
		while(pos[0].join(" ")==pos[pos.length-1].join(" ")){
			pos.pop();
		};
		
		//找到最小的一个坐标，环从这个坐标开始，免得每次采集起点不一样导致差异
		var minX=999.999999,minY=minX,idx=0;
		for(var i=0;i<pos.length;i++){
			var x=pos[i][0],y=pos[i][1];
			if(x<minX || (x==minX && y<minY)){
				minX=x;minY=y;
				idx=i;
			}
		};
		var arr2=[];
		for(var i=idx;i<pos.length;i++){
			arr2.push(pos[i]);
		}
		for(var i=0;i<idx;i++){//起点接到尾部后面
			arr2.push(pos[i]);
		}
		
		pos=[];
		for(var i=0;i<arr2.length;i++){ pos.push(arr2[i].join(" ")); }
		vals.push(pos.join(","));
	}
	return vals.join("~");
};

})();
