(function(){
  "use strict";
  var IDS=["hero-canvas","envelo-canvas","security-canvas","cat72-canvas","process-canvas"];
  var prevW=window.innerWidth,pending=false;
  function resizeAll(){pending=false;for(var i=0;i<IDS.length;i++){var el=document.getElementById(IDS[i]);if(el&&typeof el._saResize==="function"){try{el._saResize();}catch(e){}}}prevW=window.innerWidth;}
  function scheduleResize(){if(!pending){pending=true;requestAnimationFrame(resizeAll);}}
  window.addEventListener("orientationchange",function(){scheduleResize();setTimeout(scheduleResize,400);});
  window.addEventListener("resize",function(){if(Math.abs(window.innerWidth-prevW)>10)scheduleResize();},{passive:true});
  if(window.visualViewport){var vpW=window.visualViewport.width;window.visualViewport.addEventListener("resize",function(){var w=window.visualViewport.width;if(Math.abs(w-vpW)>10){vpW=w;scheduleResize();}},{passive:true});}
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&Math.abs(window.innerWidth-prevW)>10)scheduleResize();});
})();
