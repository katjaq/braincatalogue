var AtlasMakerWidget = {
	//========================================================================================
	// Globals
	//========================================================================================
	debug:			0,
	container:		null,	// Element where atlasMaker lives
	brain_offcn:	null,
	brain_offtx:	null,
	canvas:			null,
	context:		null,
	brain_px:		null,
	brain_W:		null,
	brain_H:		null,
	brain_D:		null,
	brain_Wdim:		null,
	brain_Hdim:		null,
	max:			0,
	brain_dim:		new Array(3),
	brain_pixdim:	new Array(3),
	brain_datatype:	null,
	brain:			0,
	annotationLength:0,
	User:			{  view:'sag',
					   tool:'paint',
					  slice:0,
					penSize:1,
				   penValue:1,
					 doFill:false,
				mouseIsDown:false,
						 x0:-1,
						 y0:-1,
						mri:new Object()
			},
	Collab:			[],
	atlas:			null,
	atlas_offcn:	null,
	atlas_offtx:	null,	
	atlas_px:		null,
	name:			null,
	url:			null,
	atlasFilename:	null,
	socket:			null,
	flagConnected:	0,
	flagLoadingImg: {loading:false},
	flagUsePreciseCursor: false,
	msg:			null,
	msg0:			"",
	prevData:		0,
	Crsr:			{ x:undefined,			// cursor x coord
					   y:undefined,			// cursor y coord
					   fx:undefined,		// finger x coord
					   fy:undefined,		// finger y coord
					   x0:undefined,		// previous finger x coord
					   y0:undefined,		// previous finger y coord
					   cachedX:undefined,	// finger x coord at touch start
					   cachedY:undefined,	// finger y coord at touch start
					   state:"move",		// cursor state: move, draw, configure
					   prevState:undefined,	// state before configure
					   touchStarted:false	// touch started flag
					},
	editMode:		0,	// editMode=0 to prevent editing, editMode=1 to accept it
	info:{},	// information displayed over each brain slice
	// undo stack
	Undo:[],

	//========================================================================================
	// Local user interaction
	//========================================================================================
	changeView: function(theView) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> changeView()");
	
		switch(theView) {
			case 'sagittal':
				me.User.view='sag';
				break;
			case 'coronal':
				me.User.view='cor';
				break;
			case 'axial':
				me.User.view='axi';
				break;
		}
		me.sendUserDataMessage("change view");
	
		me.configureBrainImage();
		me.configureAtlasImage();
		me.resizeWindow();

		me.drawImages();
		
		me.initCursor();

	},
	changeTool: function(theTool) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> changeTool()");
	
		switch(theTool) {
			case 'paint':
				me.User.tool='paint';
				me.User.penValue=1;
				break;
			case 'erase':
				me.User.tool='erase';
				me.User.penValue=0;
				break;
		}
		me.sendUserDataMessage("change tool");
	},
	syncViews: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> syncViews()");
		
		localStorage.AtlasMakerMultipleWindows=JSON.stringify({view:me.User.view,slice:slice});
	},
	changePenSize: function(theSize) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> changePenSize()");
	
		me.User.penSize=parseInt(theSize);
		me.sendUserDataMessage("change pen size");
	},
	changeSlice: function(slice) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> changeSlice()");
	
		me.User.slice=slice;
		me.sendUserDataMessage("change slice");
		me.drawImages();
		
		localStorage.AtlasMakerMultipleWindows=JSON.stringify({view:me.User.view,slice:slice});
	},
	changeSliceFromOtherWindow: function(e) {
		if(e.key=="AtlasMakerMultipleWindows") {
			var pos=JSON.parse(localStorage.AtlasMakerMultipleWindows);
			console.log("change in other window",pos);
		}
	},
	changeSliceFromSlider: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> changeSliceFromSlider()");

		var slice=parseInt($("#slider").slider("value"));
		me.changeSlice(slice);
	},
	prevSlice: function() {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> prevSlice()");
	
		var slice=me.User.slice-1;
		if(slice<0)
			slice=0;
		me.changeSlice(slice);

		$("#slider").slider("option","value",me.User.slice);
	},
	nextSlice: function() {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> nextSlice()");
	
		var slice=me.User.slice+1;
		if(slice>me.brain_D-1)
			slice=me.brain_D-1;
		me.changeSlice(slice);

		$("#slider").slider("option","value",me.User.slice);
	},
	toggleFill: function() {
		var me=AtlasMakerWidget;
		if(me.debug)
			console.log("> toggleFill()");
	
		me.User.doFill=!me.User.doFill;
		me.sendUserDataMessage("toggle fill");
	},
	togglePreciseCursor: function() {
		var me=AtlasMakerWidget;
		if(me.debug)
			console.log("> togglePreciseCursor()");
	
		me.flagUsePreciseCursor=!me.flagUsePreciseCursor;
		me.initCursor();
	},
	resizeWindow: function() {
		var me=AtlasMakerWidget;
		if(me.debug>1)
			console.log("> resizeWindow()");

		var wH=me.container.height();
		var wW=me.container.width();	
		var	wAspect=wW/wH;
		var	bAspect=me.brain_W*me.brain_Wdim/(me.brain_H*me.brain_Hdim);
		
		if(me.editMode==1) {
			// In edit mode width or height can be fixed to 100%
			// depending on the slice and container aspect ratio
			if(wAspect>bAspect)
				$('#resizable').css({width:(100*bAspect/wAspect)+'%',height:'100%'});
			else
				$('#resizable').css({width:'100%',height:(100*wAspect/bAspect)+'%'});
		} else {
			// In display mode slice width is always fixed to 100%
			$('#resizable').css({width:'100%',height:(100*wAspect/bAspect)+'%'});
			
			// Slice height cannot be larger than window's inner height:
			var sliceH=me.container.height();
			var windowH=window.innerHeight;
			if(sliceH>windowH) {
				var f=windowH/sliceH;
				$('#resizable').css({width:(f*100)+'%',height:f*(100*wAspect/bAspect)+'%'});
			}
			
		}
	},
	loadNifti: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> loadNifti()");
		var def=$.Deferred();
	
		if(0) {// disable MRI loading, keep slice streaming
			var oReq = new XMLHttpRequest();
			oReq.open("GET", me.User.dirname+"/"+me.User.mri, true);
			console.log(me.User.dirname+"/"+me.User.mri);
			oReq.addEventListener("progress", function(e){me.progress.html(parseInt(100*e.loaded/e.total)+"% Loaded")}, false);
			oReq.responseType = "arraybuffer";
			oReq.onload = function(oEvent) {
				var	inflate=new pako.Inflate();
				inflate.push(new Uint8Array(this.response),true);
				var data=inflate.result.buffer;
				var	dv=new DataView(data);
				var	sizeof_hdr=dv.getInt32(0,true);
				var	dimensions=dv.getInt16(40,true);
				me.brain_dim[0]=dv.getInt16(42,true);
				me.brain_dim[1]=dv.getInt16(44,true);
				me.brain_dim[2]=dv.getInt16(46,true);
				me.brain_datatype=dv.getInt16(72,true);
				me.brain_pixdim[0]=dv.getFloat32(80,true);
				me.brain_pixdim[1]=dv.getFloat32(84,true);
				me.brain_pixdim[2]=dv.getFloat32(88,true);
				var	vox_offset=dv.getFloat32(108,true);

				switch(me.brain_datatype) {
					case 8:
						me.brain=new Uint8Array(data,vox_offset);
						break;
					case 16:
						me.brain=new Int16Array(data,vox_offset);
						break;
					case 32:
						me.brain=new Float32Array(data,vox_offset);
						break;
				}

				console.log("dim",me.brain_dim[0],me.brain_dim[1],me.brain_dim[2]);
				console.log("datatype",me.brain_datatype);
				console.log("pixdim",me.brain_pixdim[0],me.brain_pixdim[1],me.brain_pixdim[2]);
				console.log("vox_offset",vox_offset);
			
				me.configureBrainImage();
				me.configureAtlasImage();
				me.resizeWindow();
				me.drawImages();

				me.initCursor();
				me.progress.html("<img src='/img/download.svg' style='vertical-align:middle'/>MRI");
		
				def.resolve();		
			};
			oReq.send();
			me.progress.html("Loading...");
			me.initCursor();
			return def.promise();
		} else {
			//me.progress.html("<img src='/img/download.svg' style='vertical-align:middle'/>MRI");
			return def.resolve();		
		}
		
	},
	saveNifti: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> saveNifti()");
	
		var	sizeof_hdr=348;
		var	dimensions=4;			// number of dimension values provided
		var	spacetimeunits=2+8;		// 2=nifti code for millimetres | 8=nifti code for seconds
		var	datatype=2;				// datatype for 8 bits (DT_UCHAR8 in nifti or UCHAR in analyze)
		var	voxel_offset=348;
		var	hdr=new ArrayBuffer(sizeof_hdr);
		var	dv=new DataView(hdr);
		dv.setInt32(0,sizeof_hdr,true);
		dv.setInt16(40,dimensions,true);
		dv.setInt16(42,me.brain_dim[0],true);
		dv.setInt16(44,me.brain_dim[1],true);
		dv.setInt16(46,me.brain_dim[2],true);
		dv.setInt16(48,1,true);
		dv.setInt16(70,datatype,true);
		dv.setInt16(74,8,true);			// bits per voxel
		dv.setFloat32(76,1,true);		// first pixdim value
		dv.setFloat32(80,me.brain_pixdim[0],true);
		dv.setFloat32(84,me.brain_pixdim[1],true);
		dv.setFloat32(88,me.brain_pixdim[2],true);
		dv.setFloat32(108,voxel_offset,true);
		dv.setInt8(123,spacetimeunits);

		var layer=me.atlas;
		var	data=layer.data;
		var	i;

		var nii = new Uint8Array(voxel_offset+data.length);
		for(i=0;i<sizeof_hdr;i++)
			nii[i]=dv.getUint8(i);
		for(i=0;i<data.length;i++)
			nii[i+voxel_offset]=data[i];
		
		var	deflate=new pako.Deflate({gzip:true});
		deflate.push(nii,true);
		var niigzBlob = new Blob([deflate.result]);
	
		$("a#download_atlas").attr("href",window.URL.createObjectURL(niigzBlob));
		$("a#download_atlas").attr("download",me.User.atlasFilename);
	},
	configureBrainImage: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> configureBrainImage()");
	
		// init query image
		switch(me.User.view) {
			case 'sag':	me.brain_W=me.brain_dim[1]/*PA*/; me.brain_H=me.brain_dim[2]/*IS*/; me.brain_D=me.brain_dim[0]; me.brain_Wdim=me.brain_pixdim[1]; me.brain_Hdim=me.brain_pixdim[2]; break; // sagital
			case 'cor':	me.brain_W=me.brain_dim[0]/*LR*/; me.brain_H=me.brain_dim[2]/*IS*/; me.brain_D=me.brain_dim[1]; me.brain_Wdim=me.brain_pixdim[0]; me.brain_Hdim=me.brain_pixdim[2]; break; // coronal
			case 'axi':	me.brain_W=me.brain_dim[0]/*LR*/; me.brain_H=me.brain_dim[1]/*PA*/; me.brain_D=me.brain_dim[2]; me.brain_Wdim=me.brain_pixdim[0]; me.brain_Hdim=me.brain_pixdim[1]; break; // axial
		}
		me.canvas.width=me.brain_W;
		me.canvas.height=me.brain_H*me.brain_Hdim/me.brain_Wdim;
		me.brain_offcn.width=me.brain_W;
		me.brain_offcn.height=me.brain_H;
		me.brain_px=me.brain_offtx.getImageData(0,0,me.brain_offcn.width,me.brain_offcn.height);
		
	//	var W=parseFloat($('#resizable').css('width'));
	//	$('#resizable').css('height', (brain_H*brain_Hdim)*W/(brain_W*brain_Wdim) );
		
		// configure user location
		me.User.slice=parseInt(me.brain_D/2);
		me.User.dim=me.brain_dim;
		me.sendUserDataMessage("configure brain image");
		
		// configure toolbar slider
		$("#slider").slider("option","max",me.brain_D);
		$("#slider").slider("option","value",me.User.slice);
		
		me.initCursor();
	},
	configureAtlasImage: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> configureAtlasImage()");
	
		// has to be run *after* configureBrainImage
		me.atlas_offcn.width=me.brain_W;
		me.atlas_offcn.height=me.brain_H;
		me.atlas_px=me.atlas_offtx.getImageData(0,0,me.atlas_offcn.width,me.atlas_offcn.height);
	},
	nearestNeighbour: function(ctx) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> nearestNeighbour()");
	
		ctx.imageSmoothingEnabled = false;
		ctx.webkitImageSmoothingEnabled = false;
		ctx.mozImageSmoothingEnabled = false;

		ctx.mozImageSmoothingEnabled = false;
		ctx.webkitImageSmoothingEnabled = false;
	},
	displayInformation: function() {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> displayInformation()");
		me.info.slice=me.User.slice;
		me.container.find("#info").html("");
		for(var k in me.info) {
			me.container.find("#info").append(k+": "+me.info[k]+"<br/>");
		}
	},
	drawImages: function() {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> drawImages()");
	
		// draw brain
		if(me.brain) {
			me.context.clearRect(0,0,me.canvas.width,me.canvas.height);
			me.displayInformation();

			me.drawBrainImage(me.User.view,me.User.slice);
			me.context.globalAlpha = 0.8;
			me.context.globalCompositeOperation = "lighter";
			me.drawAtlasImage(me.User.view,me.User.slice);
			$("#slice").html(me.User.slice);
		}
		else {
			me.sendRequestSliceMessage();

			/*
			var slice=me.User.slice;
			var img = new Image();
			img.src=[
				"/php/braincatalogue.php?",
				"action=drawNiiSlice&",
				"nii-file="+me.User.dirname+me.User.mri+"&",
				"view="+me.User.view+"&",
				"slice-index="+me.User.slice
			].join("");
			console.log(img.src);
	
			img.onload = function(){
				me.context.clearRect(0,0,me.context.canvas.width,me.canvas.height);
				me.displayInformation();

				var	w=this.width;
				var	h=this.height;
				//console.log("image size: ",w,",",h);
				if(me.canvas.width!=w || me.canvas.height!=h) {
					me.canvas.width=w;
					me.canvas.height=h;
				}

				me.flagLoadingImg.loading=false;
				me.nearestNeighbour(me.context);
				me.context.drawImage(this,0,0);//,0,0,W,h*W/w);
				
				if(slice!=me.User.slice)
					me.drawImages();
			};
			*/
		}
	},
	drawBrainImage: function(view,slice) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> drawBrainImage()");
	
		if(me.brain===0)
			return;

		ys=yc=ya=slice;
		for(y=0;y<me.brain_H;y++)
		for(x=0;x<me.brain_W;x++) {
			switch(view) {
				case 'sag':i= y*me.brain_dim[1]/*PA*/*me.brain_dim[0]/*LR*/+ x*me.brain_dim[0]/*LR*/+ys; break;
				case 'cor':i= y*me.brain_dim[1]/*PA*/*me.brain_dim[0]/*LR*/+yc*me.brain_dim[0]/*LR*/+x; break;
				case 'axi':i=ya*me.brain_dim[1]/*PA*/*me.brain_dim[0]/*LR*/+ y*me.brain_dim[0]/*LR*/+x; break;
			}
			//val=255*(me.brain[i]-me.brain_min)/((me.brain_max-me.brain_min)||1);
			val=me.brain[i];
			i=(y*me.brain_offcn.width+x)*4;
			me.brain_px.data[ i ]  =val;
			me.brain_px.data[ i+1 ]=val;
			me.brain_px.data[ i+2 ]=val;
			me.brain_px.data[ i+3 ]=255;
		}
		me.brain_offtx.putImageData(me.brain_px, 0, 0);

		me.nearestNeighbour(me.context);
		me.context.drawImage(me.brain_offcn,0,0,me.brain_W,me.brain_H*me.brain_Hdim/me.brain_Wdim);
	},
	drawAtlasImage: function(view,slice) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> drawAtlasImage()");
	
		if(!me.atlas)
			return;

		var layer=me.atlas;
		var	data=layer.data;
		var	dim=layer.dim;
		var	val;

		ys=yc=ya=slice;
		for(y=0;y<me.brain_H;y++)
		for(x=0;x<me.brain_W;x++) {
			switch(view) {
				case 'sag':i= y*dim[1]/*PA*/*dim[0]/*LR*/+ x*dim[0]/*LR*/+ys; break;
				case 'cor':i= y*dim[1]/*PA*/*dim[0]/*LR*/+yc*dim[0]/*LR*/+x; break;
				case 'axi':i=ya*dim[1]/*PA*/*dim[0]/*LR*/+ y*dim[0]/*LR*/+x; break;
			}
			val=127*data[i];
			i=(y*me.atlas_offcn.width+x)*4;
			me.atlas_px.data[ i ]  =val;
			me.atlas_px.data[ i+1 ]=0;
			me.atlas_px.data[ i+2 ]=0;
			me.atlas_px.data[ i+3 ]=255;
		}
		me.atlas_offtx.putImageData(me.atlas_px, 0, 0);

		me.nearestNeighbour(me.context);
		me.context.drawImage(me.atlas_offcn,0,0,me.brain_W,me.brain_H*me.brain_Hdim/me.brain_Wdim);
	},
	mousedown: function(e) {
		var me=AtlasMakerWidget;
		if(this.debug) console.log("> mousedown()");
	
		e.preventDefault();

		var W=parseFloat($('#atlasMaker canvas').css('width'));
		var H=parseFloat($('#atlasMaker canvas').css('height'));
		var w=parseFloat($('#atlasMaker canvas').attr('width'));
		var h=parseFloat($('#atlasMaker canvas').attr('height'));
		var o=$('#atlasMaker canvas').offset();
		var x=parseInt((e.pageX-o.left)*(w/W));
		var y=parseInt((e.pageY-o.top)*(h/H))/me.brain_Hdim; console.log("gna");
		me.down(x,y);
	},
	mousemove: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug==2) console.log("> mousemove()");
	
		e.preventDefault();
		var W=parseFloat($('#atlasMaker canvas').css('width'));
		var H=parseFloat($('#atlasMaker canvas').css('height'));
		var w=parseFloat($('#atlasMaker canvas').attr('width'));
		var h=parseFloat($('#atlasMaker canvas').attr('height'));
		var o=$('#atlasMaker canvas').offset();
		var x=parseInt((e.pageX-o.left)*(w/W));
		var y=parseInt((e.pageY-o.top)*(h/H))/me.brain_Hdim;
	
		$("#cursor").css({
			left:(x*(W/w))+'px',
			top:(y*(H/h))+'px',
			width:me.User.penSize*(W/w),
			height:me.User.penSize*(H/h)
		});
		me.move(x,y);
	},
	mouseup: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> mouseup()");
	
		me.up(e);
	},
	touchstart: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> touchstart()");
	
		e.preventDefault();

		var W=parseFloat($('#atlasMaker canvas').css('width'));
		var H=parseFloat($('#atlasMaker canvas').css('height'));
		var w=parseFloat($('#atlasMaker canvas').attr('width'));
		var h=parseFloat($('#atlasMaker canvas').attr('height'));
		var o=$('#atlasMaker canvas').offset();
		var	touchEvent;
		if(e.originalEvent)
			touchEvent=e.originalEvent.changedTouches[0];
		else
			touchEvent=e.changedTouches[0];
		var x=parseInt((touchEvent.pageX-o.left)*(w/W));
		var y=parseInt((touchEvent.pageY-o.top)*(h/H));
	
		if(me.flagUsePreciseCursor) {
			// Precision cursor
			me.Crsr.x0=x;
			me.Crsr.cachedX=x;
			me.Crsr.y0=y;
			me.Crsr.cachedY=y;
			me.Crsr.fx=$("#finger").offset().left;
			me.Crsr.fy=$("#finger").offset().top;
			me.Crsr.touchStarted=true;
			setTimeout(function() {
				if( me.Crsr.cachedX == me.Crsr.x0 && me.Crsr.cachedY==me.Crsr.y0 && !me.Crsr.touchStarted) {
					// short tap: change mode
					me.Crsr.state=(me.Crsr.state=="move")?"draw":"move";
					me.updateCursor();
				}
			},200);
			setTimeout(function() {
				if (me.Crsr.cachedX==me.Crsr.x0 && me.Crsr.cachedY==me.Crsr.y0 && me.Crsr.touchStarted) {
					// long tap: change to configure mode
					me.Crsr.prevState=me.Crsr.state;
					me.Crsr.state="configure";
					me.updateCursor();
				}
			},1000);
			me.down(me.Crsr.x,me.Crsr.y);
		} else
			me.down(x,y);
	},
	touchmove: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> touchmove()");
		
		if(me.Crsr.touchStarted==false && me.debug) {
			console.log("WARNING TO MYSELF: touch can move without having started");
		}
	
		e.preventDefault();

		var W=parseFloat($('#atlasMaker canvas').css('width'));
		var H=parseFloat($('#atlasMaker canvas').css('height'));
		var w=parseFloat($('#atlasMaker canvas').attr('width'));
		var h=parseFloat($('#atlasMaker canvas').attr('height'));
		var o=$('#atlasMaker canvas').offset();
		var	touchEvent;
		if(e.originalEvent)
			touchEvent=e.originalEvent.changedTouches[0];
		else
			touchEvent=e.changedTouches[0];
		var x=parseInt((touchEvent.pageX-o.left)*(w/W));
		var y=parseInt((touchEvent.pageY-o.top)*(h/H));
	
		if(me.flagUsePreciseCursor) {
			// Precision cursor
			var dx=x-me.Crsr.x0;
			var dy=y-me.Crsr.y0;
			if(me.Crsr.state=="move"||me.Crsr.state=="draw") {
				me.Crsr.x+=dx;
				me.Crsr.y+=dy;
				$("#cursor").css({left:me.Crsr.x*(W/w),top:me.Crsr.y*(H/h),width:me.User.penSize*(W/w),height:me.User.penSize*(H/h)});
				if(me.Crsr.state=="draw")
					me.move(me.Crsr.x,me.Crsr.y);
			}
			me.Crsr.fx+=dx*(W/w);
			me.Crsr.fy+=dy*(H/h);
			$("#finger").offset({left:me.Crsr.fx,top:me.Crsr.fy});
		
			me.Crsr.x0=x;
			me.Crsr.y0=y;
		} else {
			$("#cursor").css({
				left:(x*(W/w))+'px',
				top:(y*(H/h))+'px',
				width:me.User.penSize*(W/w),
				height:me.User.penSize*(H/h)
			});
			me.move(x,y);
		}
	},
	touchend: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> touchend()");
		
		e.preventDefault();
	
		if(me.flagUsePreciseCursor) {
			// Precision cursor
			me.Crsr.touchStarted=false;
			if(me.Crsr.state=="configure") {
				me.Crsr.state=me.Crsr.prevState;
				me.updateCursor();
			}
		}	
		me.up(e);
	},
	initCursor: function() {
		var me=AtlasMakerWidget;
		var W=parseFloat($('#atlasMaker canvas').css('width'));
		var H=parseFloat($('#atlasMaker canvas').css('height'));
		var w=parseFloat($('#atlasMaker canvas').attr('width'));
		var h=parseFloat($('#atlasMaker canvas').attr('height'));
		
		me.Crsr.x=parseInt(w/2);
		me.Crsr.y=parseInt(h/2);
		
		me.Crsr.fx=parseInt(w/2)*(W/w);
		me.Crsr.fy=parseInt(h/2)*(H/h);
		$("#cursor").css({left:(me.Crsr.x*(W/w))+"px",top:(me.Crsr.y*(H/h))+"px",width:me.User.penSize*(W/w),height:me.User.penSize*(H/h)});
		
		if(me.flagUsePreciseCursor) {
			if($("#finger").length==0) {
				me.container.append("<div id='finger'></div>");
				$("#finger").addClass("touchDevice");

				// configure touch events for tablets
				$("#finger").on("touchstart",function(e){me.touchstart(e)});
				$("#finger").on("touchend",function(e){me.touchend(e)});
				$("#finger").on("touchmove",function(e){me.touchmove(e)});
			
				// turn off eventual touch events handled by canvas
				me.canvas.ontouchstart=null;
				me.canvas.ontouchmove=null;
				me.canvas.ontouchend=null;
			}
			me.updateCursor();

			$("#finger").css({left:me.Crsr.fx+"px",top:me.Crsr.fy+"px"});
		} else {
			// remove precise cursor
			$("#finger").remove();

			// configure touch events for tablets
			me.canvas.ontouchstart=me.touchstart;
			me.canvas.ontouchmove=me.touchmove;
			me.canvas.ontouchend=me.touchend;
		}
	},
	updateCursor: function() {
		var me=AtlasMakerWidget;
		$("#finger").removeClass("move draw configure");
		switch(me.Crsr.state) {
			case "move": $("#finger").addClass("move");	break;
			case "draw": $("#finger").addClass("draw");	break;
			case "configure": $("#finger").addClass("configure");	break;
		}
		//$("#msg").html(C.state);
		//console.log(Crsr.state);
	},
	down: function(x,y) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> down()");
	
		if(MyLoginWidget.loggedin==0 || me.editMode==0)
			return;
	
		var z=me.User.slice;

		if(me.User.doFill) {
			if(me.User.penValue==0)
				me.paintxy(-1,'e',x,y,me.User);
			else
				me.paintxy(-1,'f',x,y,me.User);
		} else {
			me.User.mouseIsDown = true;
			me.sendUserDataMessage("mouse down");
			if(me.User.tool=='paint')
				me.paintxy(-1,'mf',x,y,me.User);
			else
			if(me.User.tool=='erase')
				me.paintxy(-1,'me',x,y,me.User);
		}
	
		// init annotation length counter
		me.annotationLength=0;
	},
	move: function(x,y) {
		var me=AtlasMakerWidget;
		if(me.debug==2) console.log("> move()");
	
		if(MyLoginWidget.loggedin==0 || me.editMode==0)
			return;

		var z=me.User.slice;

		if(!me.User.mouseIsDown)
			return;
		if(me.User.tool=='paint')
			me.paintxy(-1,'lf',x,y,me.User);
		else
		if(me.User.tool=='erase')
			me.paintxy(-1,'le',x,y,me.User);

	},
	up: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> up()");

		if(MyLoginWidget.loggedin==0 || me.editMode==0)
			return;

		// Send mouse up (touch ended) message
		me.User.mouseIsDown = false;
		me.User.x0=-1;
		var msg={"c":"mu"};
		me.sendPaintMessage(msg);
	
		// add annotated length to User.annotation length and post to DB
		me.logToDatabase("annotationLength",JSON.stringify({specimen:me.name,atlas:me.atlas.name,length:me.annotationLength}))
			.then(function(value){var length=parseInt(value);me.info.length=length+" mm";me.displayInformation()});

		me.annotationLength=0;
	},
	keyDown: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> keyDown()");
	
		if(e.which==37) {	// left arrow
			me.prevSlice();
			e.preventDefault();
		}
		if(e.which==39) {	// right arrow
			me.nextSlice(this);
			e.preventDefault();
		}
	},

	//========================================================================================
	// Paint functions common to all users
	//========================================================================================
	paintxy: function(u,c,x,y,usr) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> paintxy()");
	
		// u: user number
		// c: command
		// x, y: coordinates
		msg={"c":c,"x":x,"y":y};
		if(u==-1 && msg!=me.msg0) {
			me.sendPaintMessage(msg);
			me.msg0=msg;
		}
	
		var	layer=me.atlas;
		var	dim=layer.dim;
	
		var	coord={"x":x,"y":y,"z":usr.slice};
		if(usr.x0<0) {
			usr.x0=coord.x;
			usr.y0=coord.y;
		}
	
		switch(c) {
			case 'le':
				me.line(coord.x,coord.y,0,usr);
				break;
			case 'lf':
				me.line(coord.x,coord.y,1,usr);
				break;
			case 'f':
				me.fill(coord.x,coord.y,coord.z,1,usr.view);
				break;
			case 'e':
				me.fill(coord.x,coord.y,coord.z,0,usr.view);
				break;
		}

		usr.x0=coord.x;
		usr.y0=coord.y;
	},
	paintvol: function(voxels) {
		var me=AtlasMakerWidget;
		/* this function is exclusively used for undoing */
	
		if(me.debug) console.log("> paintvol()");
	
		var	i,
			ind,			// voxel index
			val,			// voxel delta-value, such that -=val undoes
			layer=me.atlas;
		for(i=0;i<voxels.length;i++) {
			ind=voxels[i][0];
			val=voxels[i][1];
			layer.data[ind]-=val;
		}

		me.drawImages();
	},
	paintslice: function(u,img,user) {
		var me=AtlasMakerWidget;
		/* part of undo */
		// u: user number
		// img: img data
		msg={"img":img};
		if(u==-1 && msg!=me.msg0) {
			//me.sendPaintMessage(msg);
			me.msg0=msg;
		}

		var layer=me.atlas;
		// Should be normally called only from the server
		// img contains the img data
		// we must apply this image on the right slice / view ( user.slice, user.view) !!
		var idx_img = 0;
		var width = getCanvasWidth(user.view);
		var height = getCanvasHeight(user.view);
		var i,x,y;
		for(y = 0 ; y < height; y++) {
			for(x = 0 ; x < width; x++) {
				i = me.slice2index(x, y, user.slice, user.view);
				layer.data[i] = img[idx_img];
				idx_img++;
			}
		}

		me.drawImages();
	},
	fill: function(x,y,z,val,myView) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> fill()");
	
		var	Q=[],n;
		var	layer=me.atlas;
		var	dim=layer.dim;
		var	i;
		
		Q.push({"x":x,"y":y});
		while(Q.length>0) {
			n=Q.pop();
			x=n.x;
			y=n.y;
			if(layer.data[me.slice2index(x,y,z,myView)]!=val) {
				layer.data[me.slice2index(x,y,z,myView)]=val;
				if(x-1>=0 && layer.data[me.slice2index(x-1,y,z,myView)]!=val)
					Q.push({"x":x-1,"y":y});
				if(x+1<me.brain_W && layer.data[me.slice2index(x+1,y,z,myView)]!=val)
					Q.push({"x":x+1,"y":y});
				if(y-1>=0 && layer.data[me.slice2index(x,y-1,z,myView)]!=val)
					Q.push({"x":x,"y":y-1});
				if(y+1<me.brain_H && layer.data[me.slice2index(x,y+1,z,myView)]!=val)
					Q.push({"x":x,"y":y+1});
			}
		}
		me.drawImages();
	},
	line: function(x,y,val,usr) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> line()");
	
		// Bresenham's line algorithm adapted from
		// http://stackoverflow.com/questions/4672279/bresenham-algorithm-in-javascript

		var	layer=me.atlas;
		var	dim=layer.dim;
		var	xyzi1=new Array(4);
		var	xyzi2=new Array(4);
		var	i;
		var	x1=usr.x0;
		var y1=usr.y0;
		var x2=x;
		var y2=y;
		var	z=usr.slice;

		// Define differences and error check
		var dx = Math.abs(x2 - x1);
		var dy = Math.abs(y2 - y1);
		var sx = (x1 < x2) ? 1 : -1;
		var sy = (y1 < y2) ? 1 : -1;
		var err = dx - dy;

		xyzi1=me.slice2xyzi(x1,y1,z,usr.view);
		xyzi2=me.slice2xyzi(x2,y2,z,usr.view);
		me.annotationLength+=Math.sqrt(	Math.pow(me.brain_pixdim[0]*(xyzi1[0]-xyzi2[0]),2)+
										Math.pow(me.brain_pixdim[1]*(xyzi1[1]-xyzi2[1]),2)+
										Math.pow(me.brain_pixdim[2]*(xyzi1[2]-xyzi2[2]),2));
	
		for(j=0;j<usr.penSize;j++)
		for(k=0;k<usr.penSize;k++) {
			i=me.slice2index(x1+j,y1+k,z,usr.view);
			layer.data[i]=val;
		}
	
		while (!((x1 == x2) && (y1 == y2))) {
			var e2 = err << 1;
			if (e2 > -dy) {
				err -= dy;
				x1 += sx;
			}
			if (e2 < dx) {
				err += dx;
				y1 += sy;
			}
			for(j=0;j<usr.penSize;j++)
			for(k=0;k<usr.penSize;k++) {
				i=me.slice2index(x1+j,y1+k,z,usr.view);
				layer.data[i]=val;
			}
		}
		me.drawImages();
	},
	slice2index: function(mx,my,mz,myView) {
		var me=AtlasMakerWidget;
		if(me.debug>1)
			console.log("> slice2index()");
	
		var	layer=me.atlas;
		var	dim=layer.dim;
		var	x,y,z;
		switch(myView) {
			case 'sag':	x=mz; y=mx; z=my;break; // sagital
			case 'cor':	x=mx; y=mz; z=my;break; // coronal
			case 'axi':	x=mx; y=my; z=mz;break; // axial
		}	
		return z*dim[1]*dim[0]+y*dim[0]+x;	
	},
	slice2xyzi: function(mx,my,mz,myView) {
		var me=AtlasMakerWidget;
		if(me.debug>1)
			console.log("> slice2xyzi()");
	
		var	layer=me.atlas;
		var	dim=layer.dim;
		var	x,y,z,i;
		switch(myView) {
			case 'sag':	x=mz; y=mx; z=my;break; // sagital
			case 'cor':	x=mx; y=mz; z=my;break; // coronal
			case 'axi':	x=mx; y=my; z=mz;break; // axial
		}
		i=z*dim[1]*dim[0]+y*dim[0]+x;
		return [x,y,z,i];	
	},
	xyz2slice: function(x,y,z,myView) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> xyz2slice()");
	
		var	mx,my,mz;
		switch(myView) {
			case 'sag':	mz=x; mx=y; my=z;break; // sagital
			case 'cor':	mx=x; mz=y; my=z;break; // coronal
			case 'axi':	mx=x; my=y; mz=z;break; // axial
		}	
		return new Object({"x":x,"y":y,"z":z});	
	},
	//========================================================================================
	// Undo
	//========================================================================================
	newUndoLayer: function() {
		var undoLayer={};
		Undo.push(undoLayer);
	},

	//========================================================================================
	// Web sockets
	//========================================================================================
	createSocket: function(host) {
		if(this.debug) console.log("> createSocket()");
	
		var ws;

		if (window.WebSocket) {
			ws=new WebSocket(host);
		} else if (window.MozWebSocket) {
			ws=new MozWebSocket(host);
		}

		return ws;
	},
	initSocketConnection: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> initSocketConnection()");
		var def=$.Deferred();
	
		// WS connection
		var host = "ws://" + window.location.host + ":8080/";
	
		if(me.debug) console.log("[initSocketConnection] host:",host);
		
		me.progress.html("Connecting...");
		
		/* work in progress: animate the connection :)
			
		setInterval(function(){
			if(me.progress.text()=="MRI")
				clearInterval(this);
			else {
				var i=me.progress.text().length;
				if(i<13) me.progress.append(".");
				else me.progress.html("Connecting");
			}
		},200);
		*/
	
		try {
			me.socket = me.createSocket(host);
			
			me.socket.onopen = function(msg) {
				if(me.debug) console.log("[initSocketConnection] onopen",msg);
				me.progress.html("<img src='/img/download.svg' style='vertical-align:middle'/>MRI");
				$("#chat").text("Chat (1 connected)");
				me.flagConnected=1;
				def.resolve();
			};
			
			me.socket.onmessage = function(msg) {
				if(me.debug>1) console.log("[initSocketConnection] onmessage",msg);
				// Message: atlas data initialisation
				if(msg.data instanceof Blob) {
					if(this.debug) console.log("received binary blob",msg.data.size,"bytes long");
					var fileReader = new FileReader();
					fileReader.onload = function() {
						var data=new Uint8Array(this.result);
						var sz=data.length;
						var ext=String.fromCharCode(data[sz-8],data[sz-7],data[sz-6]);
						
						switch(ext) {
							case "nii": {
								var	inflate=new pako.Inflate();
								inflate.push(data,true);
								var layer=new Object();
								layer.data=inflate.result;
								layer.name=me.atlasFilename;
								layer.dim=me.brain_dim;
						
								me.atlas=layer;

								me.configureBrainImage();
								me.configureAtlasImage();
								me.resizeWindow();

								me.drawImages();
								var	link=me.container.find("span#download_atlas");
								link.html("<a class='download' href='"+me.User.dirname+me.User.atlasFilename+"'><img src='/img/download.svg' style='vertical-align:middle'/></a>"+layer.name);
								break;
							}
							case "jpg": {
								var urlCreator = window.URL || window.webkitURL;
								var imageUrl = urlCreator.createObjectURL(msg.data);
								var img = new Image();
								img.onload=function(){
									me.context.clearRect(0,0,me.context.canvas.width,me.canvas.height);
									me.displayInformation();

									me.nearestNeighbour(me.context);
									me.context.drawImage(this,0,0,me.brain_W,me.brain_H*me.brain_Hdim/me.brain_Wdim);

									me.context.globalAlpha = 0.8;
									me.context.globalCompositeOperation = "lighter";
									me.drawAtlasImage(me.flagLoadingImg.view,me.flagLoadingImg.slice);
									$("#slice").html(me.User.slice);
									
									me.flagLoadingImg.loading=false;

									if(me.flagLoadingImg.view!=me.User.view ||me.flagLoadingImg.slice!=me.User.slice) {
										me.sendRequestSliceMessage();
									}
								}
								img.src=imageUrl;
								
								break;
							}
						}
					};
					fileReader.readAsArrayBuffer(msg.data);
					return;
				}
			
				// Message: interaction message
				var	data=JSON.parse(msg.data);
			
				// [deprecated]
				// If we receive a message from an unknown user,
				// send our own data to make us known
				// [now, the server does the introductions]
				/*
				if(data.uid!=undefined && !Collab[data.uid]) {
					console.log("Received message from unknown user");
					sendUserDataMessage("introduce to new user");
				}
				*/
			
				switch(data.type) {
					case "intro":
						me.receiveUserDataMessage(data);
						break;
					case "chat":
						me.receiveChatMessage(data);
						break;
					case "paint":
						me.receivePaintMessage(data);
						break;
					case "paintvol":
						me.receivePaintVolumeMessage(data);
						break;
					case "disconnect":
						me.receiveDisconnectMessage(data);
						break;
				}
			};
			
			me.socket.onclose = function(msg) {
				me.socket.send(JSON.stringify({"type":"echo","msg":"user socket closing","username":me.User.username}));
				$("#chat").text("Chat (disconnected)");
				me.flagConnected=0;
			};
		}
		catch (ex) {
			$("#chat").text("Chat (not connected - connection error)");
		}
		
		return def.promise();
	},
	sendUserDataMessage: function(description) {
		var me=AtlasMakerWidget;

		if(me.flagConnected==0)
			return;

		if(me.debug>1) console.log("> sendUserDataMessage()");
		
		var msg={"type":"intro","user":me.User,"description":description};
		try {
			me.socket.send(JSON.stringify(msg));
		} catch (ex) {
			console.log("ERROR: Unable to sendUserDataMessage",ex);
		}
	},
	receiveUserDataMessage: function(data) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> receiveUserDataMessage()");
		if(me.debug) console.log("description: "+data.description,data);
	
		var u=data.uid;
	
		if(me.Collab[u]==undefined) {
			try {
				var	msg="<b>"+data.user.username+"</b> entered atlas "+data.user.specimenName+"/"+data.user.atlasFilename+"<br />"
				$("#log").append(msg);
				$("#log").scrollTop($("#log")[0].scrollHeight);
			} catch (e) {
				console.log(e);
			}
		}
		me.Collab[u]=data.user;
	
		var	nusers=1+me.Collab.filter(function(value) { return value !== undefined }).length;
		$("#chat").text("Chat ("+nusers+" connected)");
	},
	sendChatMessage: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> sendChatMessage()");
	
		if(me.flagConnected==0)
			return;
		var msg = $('input#msg')[0].value;
		try {
			me.socket.send(JSON.stringify({"type":"chat","msg":msg,"username":me.User.username}));
			var	msg="<b>me: </b>"+msg+"<br />";
			$("#log").append(msg);
			$("#log").scrollTop($("#log")[0].scrollHeight);
			$('input#msg').val("");
		} catch (ex) {
			console.log("ERROR: Unable to sendChatMessage",ex);
		}
	},
	receiveChatMessage: function(data) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> receiveChatMessage()");
	
		var	theView=me.Collab[data.uid].view;
		var	theSlice=me.Collab[data.uid].slice;
		var theUsername=data.username;
		var	msg="<b>"+theUsername+" ("+theView+" "+theSlice+"): </b>"+data.msg+"<br />"
		$("#log").append(msg);
		$("#log").scrollTop($("#log")[0].scrollHeight);
	},
	sendPaintMessage: function(msg) {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> sendPaintMessage()");
	
		if(me.flagConnected==0)
			return;
		try {
			me.socket.send(JSON.stringify({type:"paint",data:msg}));
		} catch (ex) {
			console.log("ERROR: Unable to sendPaintMessage",ex);
		}
	},
	receivePaintMessage: function(data) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> receivePaintMessage()");
	
		var	msg=data.data;
		var u=parseInt(data.uid);	// user
		var c=msg.c;	// command
		var x=parseInt(msg.x);	// x coordinate
		var y=parseInt(msg.y);	// y coordinate

		me.paintxy(u,c,x,y,me.Collab[u]);
	},
	receivePaintVolumeMessage: function(data) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> receivePaintVolumeMessage()");
	
		var	i,ind,val,voxels;
	
		voxels=data.data;
		me.paintvol(voxels.data);
	},
	sendPaintSliceMessage: function(msg) {
		var me=AtlasMakerWidget;
		/* part of undo */
		if(me.debug) console.log("[sendPaintSliceMessage]");

		if(me.flagConnected==0)
			return;
		try {
			me.socket.send(JSON.stringify({type:"img",data:msg}));
			me.socket.send(msg);
		} catch (ex) {
			console.log("ERROR: Unable to sendImgMessage",ex);
		}
	},
	receivePaintSliceMessage: function(data) {
		var me=AtlasMakerWidget;
		/* part of undo */
		if(me.debug) console.log("[receivePaintSliceMessage]");

		var msg=data.data;
		var u=parseInt(data.uid);       // user
		var img=msg.img;    // img data

		me.paintslice(u,img,me.Collab[u]);
	},
	sendUndoMessage: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> sendUndoMessage()");
	
		if(me.flagConnected==0)
			return;
		try {
			me.socket.send(JSON.stringify({type:"paint",data:{c:"u"}}));
		} catch (ex) {
			console.log("ERROR: Unable to sendUndoMessage",ex);
		}
	},
	sendRequestSliceMessage: function() {
		var me=AtlasMakerWidget;
		if(me.debug>1) console.log("> sendRequestSliceMessage()");
		if(me.flagConnected==0)
			return;
		if(me.flagLoadingImg.loading==true)
			return;
		try {
			me.socket.send(JSON.stringify({type:"requestSlice"}));
			me.flagLoadingImg.loading=true;
			me.flagLoadingImg.view=me.User.view;
			me.flagLoadingImg.slice=me.User.slice;

		} catch (ex) {
			console.log("ERROR: Unable to sendRequestSliceMessage",ex);
		}
	},
	receiveDisconnectMessage: function(data) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> receiveDisconnectMessage()");
		var u=parseInt(data.uid);	// user
		var	msg="<b>"+me.Collab[u].username+"</b> left atlas "+me.Collab[u].specimenName+"/"+me.Collab[u].atlasFilename+"<br />"
		me.Collab.splice(u,1);
		var	nusers=1+me.Collab.filter(function(value) { return value !== undefined }).length;
		$("#chat").text("Chat ("+nusers+" connected)");
		$("#log").append(msg);
		$("#log").scrollTop($("#log")[0].scrollHeight);
	},
	onkey: function(e) {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> onkey()");
	
		if (e.keyCode == 13) {
			me.sendChatMessage();
		}
	},
	quit: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log("> quit()");
	
		me.log("","Goodbye!");
		me.socket.close();
		me.socket = null;
	},
	//==========
	// Database
	//==========
	logToDatabase: function(key,value) {
		var def=$.Deferred();
		$.ajax({
			url:"/php/braincatalogue.php",
			type:"POST",
			data: {
				action:"add_log",
				userName:MyLoginWidget.username,
				key:key,
				value:value
		}})
		.done(function(data) {
			def.resolve(data);
		})
		.fail(function() {
			def.reject("Error");
		});
		return def.promise();
	},


	//========================================================================================
	// Configuration
	//========================================================================================
	initAtlasMaker: function(elem) {
		var me=AtlasMakerWidget;
		if(me.debug)
			console.log("> initAtlasMaker()");
	
		// create offscreen canvas for mri and atlas
		me.brain_offcn=document.createElement('canvas');
		me.brain_offtx=me.brain_offcn.getContext('2d');
		me.atlas_offcn=document.createElement('canvas');
		me.atlas_offtx=me.atlas_offcn.getContext('2d');

		// set widget div (create one if none)
		//var div = Siph.settings[0].container;
		if(elem==undefined) {
			me.container=$("<div class='atlasMaker'>");
			$(document.body).append(me.container);
		}
		else {
			me.container=elem;
			if(me.debug) console.log("Container: ",me.container);
		}
		
		// Init drawing canvas
		me.container.append([
			'<div id="resizable">',
			'	<canvas id="canvas"></canvas>',
			'</div>'
		].join("\n"));
		me.canvas = me.container.find('canvas')[0];
		me.context = me.canvas.getContext('2d');

		// Add div to display slice number
		me.container.find("#resizable").append("<div id='info'></div>");
		
		// Add div to use as cursor
		me.container.append("<div id='cursor'></div>");
		
		// Add precise cursor
		var isTouchArr=[];//["iPad","iPod"];
		var curDevice=navigator.userAgent.split(/[(;]/)[1];
		if($.inArray(curDevice,isTouchArr)>=0) {
			me.flagUsePreciseCursor=true;
			me.initCursor();
		}

		// configure mouse events for desktop computers
		me.canvas.onmousedown = me.mousedown;
		me.canvas.onmousemove = me.mousemove;
		me.canvas.onmouseup = me.mouseup;

		// connect event to respond to window resizing
		$(window).resize(function() {
			me.resizeWindow();
		});

		// Init the toolbar: load template, wire actions
		var def=$.Deferred();
		$.get("/templates/atlasMakerTools.html",function(html) {
			console.log("toolbar html loaded");
			me.container.append(html);
			
			// hide or show annotation tools depending on login changes
			if(MyLoginWidget) {
				console.log("subscribing to login changes");
				me.loginChanged();
				MyLoginWidget.subscribe(me.loginChanged);
			}

			// intercept keyboard events
			$(document).keydown(function(e){me.keyDown(e)});

			// configure annotation tools
			$("a#download_atlas").button().click(function(){me.saveNifti()});
			$("div#plane").buttonset().unbind('keydown');
			$("#plane input[type=radio]").change(function(){me.changeView($(this).attr('id'))})
			$("span#tool").buttonset().unbind('keydown');
			$("#tool input[type=radio]").change(function(){me.changeTool($(this).attr('id'))})
			$("button#undo").button().click(function(){me.sendUndoMessage()});
			$("input#fill").button().click(function(){me.toggleFill()});
			$("input#precise").button().click(function(){me.togglePreciseCursor()});
			$("input#sync").button().click(function(){me.syncViews()});
			$("div#penSize").buttonset().unbind('keydown');
			$("#penSize input[type=radio]").change(function(){me.changePenSize($(this).attr('id'))});
			$("#slider").slider({slide:me.changeSliceFromSlider,min:0,step:1});
			$("button#prevSlice").button().click(function(){me.prevSlice()});
			$("button#nextSlice").button().click(function(){me.nextSlice()});			
			$("div#toolbar").blur();
			
			def.resolve();
		});
		
		// get pointer to progress div
		me.progress=$("a.download_MRI");
		
		// Init web socket connection
		me.initSocketConnection()
		.then(me.sendUserDataMessage);
		
		// Listen to localStorage changes for slice change
		window.addEventListener('storage', me.changeSliceFromOtherWindow, false);
		
		return def.promise();
	},
	configureAtlasMaker: function (info,index) {
		var me=AtlasMakerWidget;
		var def=$.Deferred();
		if(me.debug)
			console.log("configureAtlasMaker");
		
		me.configureMRI(info,index)
		.then(function() {
			me.sendUserDataMessage();
			def.resolve();
		});

		return def.promise();
	},
	configureMRI: function(info,index) {
		var me=AtlasMakerWidget;
		var def=$.Deferred();
		
		console.log("> initMRI()");
				
		// Get data from AtlasMaker object
		me.name=info.name;
		me.url=info.url;
		me.atlasFilename=info.mri.atlas[index].filename;

		// get local file path from url
		me.User.dirname=me.url; // TEMPORARY
		me.User.mri=info.mri.brain;
		me.User.specimenName=info.name;
		me.User.atlasFilename=info.mri.atlas[index].filename;
		
		me.flagLoadingImg={loading:false};
		
		// get volume dimensions
		me.brain_dim=info.mri.dim;
		if(info.mri.pixdim)
			me.brain_pixdim=info.mri.pixdim;
		else
			me.brain_pixdim=[1,1,1];

		// configure toolbar slider
		me.User.slice=parseInt(info.mri.dim[0]/2);
		$("#slider").slider("option","max",info.mri.dim[0]);
		$("#slider").slider("option","value",me.User.slice);
		me.drawImages();

		if(me.brain===0) {
			me.loadNifti().then(function() {
				me.drawImages();
				def.resolve();
			});
		} else {
			def.resolve();
		}
		
		return def.promise();
	},
	loginChanged: function() {
		var me=AtlasMakerWidget;
		if(me.debug) console.log(">loginChanged() to",MyLoginWidget.loggedin);
		if(MyLoginWidget.loggedin) {
			$('body').addClass('loggedIn');
			//$(".loginRequired").css('display','inline-block');	// Show all controls required to log in
			me.User.username=MyLoginWidget.username;
			me.sendUserDataMessage("logged in");	// inform the server
		}
		else {
			$('body').removeClass('loggedIn');
			//$(".loginRequired").css('display','none');	// Hide all controls required to log in
			me.sendUserDataMessage("logged out");	// inform the server
		}
	}
};
/*
				 0		int   sizeof_hdr;    //!< MUST be 348           //  // int sizeof_hdr;      //
				 4		char  data_type[10]; //!< ++UNUSED++            //  // char data_type[10];  //
				 14		char  db_name[18];   //!< ++UNUSED++            //  // char db_name[18];    //
				 32		int   extents;       //!< ++UNUSED++            //  // int extents;         //
				 36		short session_error; //!< ++UNUSED++            //  // short session_error; //
				 38		char  regular;       //!< ++UNUSED++            //  // char regular;        //
				 39		char  dim_info;      //!< MRI slice ordering.   //  // char hkey_un0;       //

													  //--- was image_dimension substruct ---//
				 40		short dim[8];        //!< Data array dimensions.//  // short dim[8];        //
				 56		float intent_p1 ;    //!< 1st intent parameter. //  // short unused8;       //
																	 // short unused9;       //
				 60		float intent_p2 ;    //!< 2nd intent parameter. //  // short unused10;      //
																	 // short unused11;      //
				 64		float intent_p3 ;    //!< 3rd intent parameter. //  // short unused12;      //
																	 // short unused13;      //
				 68		short intent_code ;  //!< NIFTI_INTENT_* code.  //  // short unused14;      //
				 70		short datatype;      //!< Defines data type!    //  // short datatype;      //
				 72		short bitpix;        //!< Number bits/voxel.    //  // short bitpix;        //
				 74		short slice_start;   //!< First slice index.    //  // short dim_un0;       //
				 76		float pixdim[8];     //!< Grid spacings.        //  // float pixdim[8];     //
				 108	float vox_offset;    //!< Offset into .nii file //  // float vox_offset;    //
				 112	float scl_slope ;    //!< Data scaling: slope.  //  // float funused1;      //
				 116	float scl_inter ;    //!< Data scaling: offset. //  // float funused2;      //
				 120	short slice_end;     //!< Last slice index.     //  // float funused3;      //
				 122	char  slice_code ;   //!< Slice timing order.   //
				 123	char  xyzt_units ;   //!< Units of pixdim[1..4] //
				 124	float cal_max;       //!< Max display intensity //  // float cal_max;       //
				 128	float cal_min;       //!< Min display intensity //  // float cal_min;       //
				 132	float slice_duration;//!< Time for 1 slice.     //  // float compressed;    //
				 136	float toffset;       //!< Time axis shift.      //  // float verified;      //
				 140	int   glmax;         //!< ++UNUSED++            //  // int glmax;           //
				 144	int   glmin;         //!< ++UNUSED++            //  // int glmin;           //
*/
