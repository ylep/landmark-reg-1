(function() { /* IIFE */
  "use strict";

  angular
    .module("landmarkRegApp.viewer")
    .component("zoomer", {
      templateUrl: "viewer/zoomer.template.html",
      controller: ZoomerController,
      bindings: {
        cursor: "<",
        imageUrl: "@",
        onCursorUpdate: "&"
      }
    });

  function ZoomerController(ZoomerMetadata, $element, $scope, $log) {
    var vm = this;

    vm.$onInit = $onInit;
    vm.$onChanges = $onChanges;
    vm.$postLink = $postLink;
    vm.$onDestroy = $onDestroy;

    vm.axis_label = axis_label;
    vm.toggle_axis_inversion = toggle_axis_inversion;

    ////////////

    function $onInit() {
      vm.image_info = ZoomerMetadata.get_metadata(vm.imageUrl);
      vm.image_info.url = vm.imageUrl;

      // Data axes (x, y, z) are written in lowercase. Display axes (X, Y, Z)
      // are fixed relative to the layout, they are written in uppercase.

      if(vm.image_info.axis_orientations) {
        var ornt = vm.image_info.axis_orientations;
        vm.data_to_display_axis = {
          "x": AXIS_PERMUTATION[ornt[0]],
          "y": AXIS_PERMUTATION[ornt[1]],
          "z": AXIS_PERMUTATION[ornt[2]]
        };
        vm.data_axis_inversions = {
          "x": AXIS_INVERSION[ornt[0]],
          "y": AXIS_INVERSION[ornt[1]],
          "z": AXIS_INVERSION[ornt[2]]
        };
      } else {
        // Assume native Zoomer orientation
        vm.data_to_display_axis = {"x": "X", "y": "Y", "z": "Z"};
        vm.data_axis_inversions = {"x": false, "y": false, "z": false};
      }

      updateDisplayAxisSwap();

      vm.cut = {
        X: vm.image_info.size[vm.display_to_data_axis_idx.X] / 2,
        Y: vm.image_info.size[vm.display_to_data_axis_idx.Y] / 2,
        Z: vm.image_info.size[vm.display_to_data_axis_idx.Z] / 2
      };
      vm.onCursorUpdate({cursor: cut_to_cursor(vm.cut)});
    }

    function $postLink() {
      if(!vm.image_info) {
        $log.error("no available image metadata for " + vm.imageUrl);
        return;
      }

      var image_url = vm.image_info.url;
      var Xdim = vm.image_info.size[vm.display_to_data_axis_idx.X];
      var Ydim = vm.image_info.size[vm.display_to_data_axis_idx.Y];
      var Zdim = vm.image_info.size[vm.display_to_data_axis_idx.Z];
      var level_offset;
      if(vm.image_info.level_offset)
        level_offset = vm.image_info.level_offset;
      else
        level_offset = 0;
      var max_level = vm.image_info.max_level;
      var tile_size= vm.image_info.tile_size;

      var top_left_canvas = $element.find("canvas.top_left")[0];
      var top_right_canvas = $element.find("canvas.top_right")[0];
      var bottom_left_canvas = $element.find("canvas.bottom_left")[0];
      // TODO handle resize?
      top_left_canvas.height = top_left_canvas.clientHeight;
      top_left_canvas.width = top_left_canvas.clientWidth;
      top_right_canvas.width = top_right_canvas.clientWidth;
      top_right_canvas.height = top_right_canvas.clientHeight;
      bottom_left_canvas.width = bottom_left_canvas.clientWidth;
      bottom_left_canvas.height = bottom_left_canvas.clientHeight;

      function tilecomplete(tile,swap_axes,next){
        var canvas=document.createElement("canvas");
        canvas.width=tile_size;
        canvas.height=tile_size;
        if(tile !== null) {
          var ctx = canvas.getContext("2d")
          if(swap_axes)
            ctx.setTransform(0, 1, 1, 0, 0, 0);
          else
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(tile,0,0);
        }
        next(canvas);
      }
      function cross(x,y,ctx,cnvw,cnvh,cutx,cuty,cutw,cuth){
        ctx.strokeStyle="#FF8080";
        ctx.beginPath();
        var lx=Math.round((x-cutx)*cnvw/cutw)+0.5;
        ctx.moveTo(lx,0);
        ctx.lineTo(lx,cnvh);
        var ly=Math.round((y-cuty)*cnvh/cuth)+0.5;
        ctx.moveTo(0,ly);
        ctx.lineTo(cnvw,ly);
        ctx.closePath();
        ctx.stroke();
      }

      function url_for_tile(level, slice_axis, slice_number,
                            axis1, idx1, axis2, idx2)
      {
        var vertical_idx, horizontal_idx;
        if(AXIS_SWAP_NEEDED[axis1 + axis2]) {
          horizontal_idx = idx1;
          vertical_idx = idx2;
        } else {
          vertical_idx = idx1;
          horizontal_idx = idx2;
        }
        return image_url
          + "/" + (level + level_offset)
          + "/" + slice_axis
          + "/" + ("0000" + slice_number).substr(-4, 4)
          + "/" + INPLANE_AXES_FOR_SLICE_AXIS[slice_axis][0] + ("00" + vertical_idx).substr(-2, 2)
          + "_" + INPLANE_AXES_FOR_SLICE_AXIS[slice_axis][1] + ("00" + horizontal_idx).substr(-2, 2)
          + ".png";
      }

      var top_left_zoomer = new Zoomer(top_left_canvas, {  // X-Y
        Width: Xdim,
        Height: Ydim,
        TileSize: tile_size,
        maxlevel: max_level,
        MirrorHoriz: vm.data_axis_inversions[vm.display_to_data_axis.X],
        MirrorVert: vm.data_axis_inversions[vm.display_to_data_axis.Y],
        Key:function(level,X,Y){
          var Z=vm.cut.Z;
          for(var i=0;i<level;i++)
            Z=(Z+1)>>1;
          Z = Math.round(Z);
          return url_for_tile(level, vm.display_to_data_axis.Z, Z,
                              vm.display_to_data_axis.Y, Y,
                              vm.display_to_data_axis.X, X);
        },
        Load:function(url,x,y,next){
          var img=document.createElement("img");
          img.onload=function(){tilecomplete(img,AXIS_SWAP_NEEDED[vm.display_to_data_axis.Y + vm.display_to_data_axis.X],next);};
          img.onerror=function(){
            $log.warn("Invalid tile: "+x+","+y+ " "+url);
            tilecomplete(null,null,next);
          };
          img.src=url;
        },
        Overlay:function(ctx,cw,ch,x,y,w,h){
          cross(vm.cut.X,vm.cut.Y,ctx,cw,ch,x,y,w,h);
        },
        Click:function(event,clickx, clicky){
          vm.cut.X=clickx;
          vm.cut.Y=clicky;
          cutUpdatedByZoomer();
          redraw();
        },
        Dispatch:function(){
          top_right_zoomer.setmidzoom(top_right_zoomer.getmidx(),
                                      top_left_zoomer.getmidy(),
                                      top_left_zoomer.getzoom());
          bottom_left_zoomer.setmidzoom(top_left_zoomer.getmidx(),
                                        bottom_left_zoomer.getmidy(),
                                        top_left_zoomer.getzoom());
        },
        Scroll:function(slices){
          vm.cut.Z += slices;
          if(vm.cut.Z < 0)
            vm.cut.Z = 0;
          else if(vm.cut.Z >= Zdim)
            vm.cut.Z = Zdim;
          cutUpdatedByZoomer();
          redraw();
        }
      });
      vm.top_left_zoomer = top_left_zoomer;
      top_left_zoomer.fullcanvas();

      var top_right_zoomer = new Zoomer(top_right_canvas, {  // Z-Y
        Width:Zdim,
        Height:Ydim,
        TileSize:tile_size,
        maxlevel:max_level,
        MirrorHoriz: vm.data_axis_inversions[vm.display_to_data_axis.Z],
        MirrorVert: vm.data_axis_inversions[vm.display_to_data_axis.Y],
        Key:function(level,Z,Y){
          var X=vm.cut.X;
          for(var i=0;i<level;i++)
            X=(X+1)>>1;
          X = Math.round(X);
          return url_for_tile(level, vm.display_to_data_axis.X, X,
                              vm.display_to_data_axis.Y, Y,
                              vm.display_to_data_axis.Z, Z);
        },
        Load:function(url,x,y,next){
          var img=document.createElement("img");
          img.onload=function(){tilecomplete(img,AXIS_SWAP_NEEDED[vm.display_to_data_axis.Y + vm.display_to_data_axis.Z],next);};
          img.onerror=function(){
            $log.warn("Invalid tile: "+x+","+y+ " "+url);
            tilecomplete(null,null,next);
          };
          img.src=url;
        },
        Overlay:function(ctx,cw,ch,x,y,w,h){
          cross(vm.cut.Z,vm.cut.Y,ctx,cw,ch,x,y,w,h);
        },
        Click:function(event,clickx, clicky){
          vm.cut.Z=clickx;
          vm.cut.Y=clicky;
          cutUpdatedByZoomer();
          redraw();
        },
        Dispatch:function(){
          top_left_zoomer.setmidzoom(top_left_zoomer.getmidx(),
                                     top_right_zoomer.getmidy(),
                                     top_right_zoomer.getzoom());
          bottom_left_zoomer.setmidzoom(bottom_left_zoomer.getmidx(),
                                        top_right_zoomer.getmidx(),
                                        top_right_zoomer.getzoom());
        },
        Scroll:function(slices){
          vm.cut.X += slices;
          if(vm.cut.X < 0)
            vm.cut.X = 0;
          else if(vm.cut.X >= Xdim)
            vm.cut.X = Xdim;
          cutUpdatedByZoomer();
          redraw();
        }
      });
      vm.top_right_zoomer = top_right_zoomer;
      top_right_zoomer.fullcanvas();

      var bottom_left_zoomer = new Zoomer(bottom_left_canvas, {  // X-Z
        Width: Xdim,
        Height: Zdim,
        TileSize: tile_size,
        maxlevel: max_level,
        MirrorHoriz: vm.data_axis_inversions[vm.display_to_data_axis.X],
        MirrorVert: vm.data_axis_inversions[vm.display_to_data_axis.Z],
        Key:function(level,X,Z){
          var Y=vm.cut.Y;
          for(var i=0;i<level;i++)
            Y=(Y+1)>>1;
          Y = Math.round(Y);
          return url_for_tile(level, vm.display_to_data_axis.Y, Y,
                              vm.display_to_data_axis.Z, Z,
                              vm.display_to_data_axis.X, X);
        },
        Load:function(url,x,y,next){
          var img=document.createElement("img");
          img.onload=function(){tilecomplete(img,AXIS_SWAP_NEEDED[vm.display_to_data_axis.Z + vm.display_to_data_axis.X],next);};
          img.onerror=function(){
            $log.warn("Invalid tile: "+x+","+y+ " "+url);
            tilecomplete(null,null,next);
          };
          img.src=url;
        },
        Overlay:function(ctx,cw,ch,x,y,w,h){
          cross(vm.cut.X,vm.cut.Z,ctx,cw,ch,x,y,w,h);
        },
        Click:function(event, clickx, clicky){
          vm.cut.X=clickx;
          vm.cut.Z=clicky;
          cutUpdatedByZoomer();
          redraw();
        },
        Dispatch:function(){
          top_left_zoomer.setmidzoom(bottom_left_zoomer.getmidx(),
                                     top_left_zoomer.getmidy(),
                                     bottom_left_zoomer.getzoom());
          top_right_zoomer.setmidzoom(bottom_left_zoomer.getmidy(),
                                      top_right_zoomer.getmidy(),
                                      bottom_left_zoomer.getzoom());
        },
        Scroll:function(slices){
          vm.cut.Y += slices;
          if(vm.cut.Y < 0)
            vm.cut.Y = 0;
          else if(vm.cut.Y >= Ydim)
            vm.cut.Y = Ydim;
          cutUpdatedByZoomer();
          redraw();
        }
      });
      vm.bottom_left_zoomer = bottom_left_zoomer;
      bottom_left_zoomer.fullcanvas();

      // Synchronize the zoom level for all views, because fullcanvas sets it
      // individually.
      var zoom = Math.max(top_left_zoomer.getzoom(),
                          top_right_zoomer.getzoom(),
                          bottom_left_zoomer.getzoom());
      top_left_zoomer.setmidzoom(vm.cut.X,vm.cut.Y,zoom);
      top_right_zoomer.setmidzoom(vm.cut.Z,vm.cut.Y,zoom);
      bottom_left_zoomer.setmidzoom(vm.cut.X,vm.cut.Z,zoom);
    }

    // Synchronize the views when the cursor is updated externally (e.g. Go
    // To Landmark).
    function $onChanges(changes) {
      if(!vm.image_info)
        return;

      if(changes.cursor) {
        // TODO handle out-of-bounds
        //
        // We cannot replace vm.cut with the new object (vm.cut = ...), because
        // the Zoomer instances would still use the old object. Update the
        // properties in-place instead.
        $.extend(vm.cut, cursor_to_cut(changes.cursor.currentValue));
        if(vm.bottom_left_zoomer
           && vm.top_right_zoomer
           && vm.top_left_zoomer) {
          redraw();
        }
      }

      if(changes.imageUrl) {
        $log.error("dynamically changing the image shown by Zoomer is not supported");
      }
    }

    function $onDestroy() {
      $log.warn("$onDestroy is not implemented, memory may be leaked");
    }

    function cutUpdatedByZoomer() {
      $scope.$apply(function() {
        vm.onCursorUpdate({cursor: cut_to_cursor(vm.cut)});
      });
    }

    function cut_to_cursor(cut) {
      return [
        cut[vm.data_to_display_axis["x"]] * vm.image_info.voxel_size[0],
        cut[vm.data_to_display_axis["y"]] * vm.image_info.voxel_size[1],
        cut[vm.data_to_display_axis["z"]] * vm.image_info.voxel_size[2]
      ];
    }

    function cursor_to_cut(cursor) {
      var axX = vm.display_to_data_axis_idx.X;
      var axY = vm.display_to_data_axis_idx.Y;
      var axZ = vm.display_to_data_axis_idx.Z;
      return {
        "X": Math.round(cursor[axX] / vm.image_info.voxel_size[axX]),
        "Y": Math.round(cursor[axY] / vm.image_info.voxel_size[axY]),
        "Z": Math.round(cursor[axZ] / vm.image_info.voxel_size[axZ])
      };
    }

    // uses vm.data_to_display_axis as an input
    function updateDisplayAxisSwap() {
      // Invert the mapping
      vm.display_to_data_axis = {};
      for(var axis in vm.data_to_display_axis) {
        vm.display_to_data_axis[vm.data_to_display_axis[axis]] = axis;
      }

      vm.display_to_data_axis_idx = {
        "X": DATA_AXIS_NAME_TO_INDEX[vm.display_to_data_axis.X],
        "Y": DATA_AXIS_NAME_TO_INDEX[vm.display_to_data_axis.Y],
        "Z": DATA_AXIS_NAME_TO_INDEX[vm.display_to_data_axis.Z]
      };
    }

    /* the argument is one of the strings: X-, X+, Y-, Y+, Z-, Z+ */
    function axis_label(oriented_display_axis) {
      var data_axis = vm.display_to_data_axis[oriented_display_axis[0]];
      var negative_data_axis = (oriented_display_axis[1] == "-")
          != vm.data_axis_inversions[data_axis];
      if(vm.image_info.axis_orientations) {
        var data_axis_idx = DATA_AXIS_NAME_TO_INDEX[data_axis];
        if(negative_data_axis)
          return INVERSE_AXIS_NAMES[vm.image_info.axis_orientations[data_axis_idx]];
        else
          return vm.image_info.axis_orientations[data_axis_idx];
      } else {
        return data_axis + (negative_data_axis ? "-" : "+");
      }
    }

    function toggle_axis_inversion(display_axis) {
      var data_axis = vm.display_to_data_axis[display_axis];
      vm.data_axis_inversions[data_axis] = !vm.data_axis_inversions[data_axis];
      update_axis_inversions();
    }

    function update_axis_inversions() {
      vm.top_left_zoomer.reconfigure({
        MirrorHoriz: vm.data_axis_inversions[vm.display_to_data_axis.X],
        MirrorVert: vm.data_axis_inversions[vm.display_to_data_axis.Y]
      });
      vm.top_right_zoomer.reconfigure({
        MirrorHoriz: vm.data_axis_inversions[vm.display_to_data_axis.Z],
        MirrorVert: vm.data_axis_inversions[vm.display_to_data_axis.Y]
      });
      vm.bottom_left_zoomer.reconfigure({
        MirrorHoriz: vm.data_axis_inversions[vm.display_to_data_axis.X],
        MirrorVert: vm.data_axis_inversions[vm.display_to_data_axis.Z]
      });
      redraw();
    }
    function redraw() {
      vm.top_left_zoomer.redraw();
      vm.top_right_zoomer.redraw();
      vm.bottom_left_zoomer.redraw();
    }

    // The following objects are constant, they describe the filename lay-out
    // of Zoomer tiles. TODO: move this to a service, make it modular to
    // support DZI.
    var DATA_AXIS_NAME_TO_INDEX = {"x": 0, "y": 1, "z": 2};
    var INPLANE_AXES_FOR_SLICE_AXIS = {
      "x": ["y", "z"],
      "y": ["z", "x"],
      "z": ["y", "x"]
    };
    var AXIS_SWAP_NEEDED = {
      "yz": false,
      "zy": true,
      "zx": false,
      "xz": true,
      "yx": false,
      "xy": true
    };

    // Constants related to the anatomical meaning of axes
    var INVERSE_AXIS_NAMES = {"R": "L", "L": "R",
                              "A": "P", "P": "A",
                              "S": "I", "I": "S"};
    // These constants define a lay-out in neurological convention (subject
    // right to the right of the screen) with the coronal view on the top
    // left, axial view on the bottom left, sagittal view on the top right.
    var AXIS_PERMUTATION = {"R": "X", "L": "X",
                            "S": "Y", "I": "Y",
                            "A": "Z", "P": "Z"};
    var AXIS_INVERSION = {"R": false, "L": true,
                          "S": true, "I": false,
                          "A": true, "P": false};
  }
})(); /* IIFE */
