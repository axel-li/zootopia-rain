/* ============================================================
   动物城睡前故事 · 共享引擎 ZStory
   能力：滚动浮现 / 天气画布（雨·雪） / 钢琴 BGM / 点灯互动 / 阅读标记
   每个故事页只需配置自己的参数，详见各页底部 init 调用
   ============================================================ */
window.ZStory=(function(){
  "use strict";
  var qs=new URLSearchParams(location.search);
  var STATIC=qs.get("static")==="1";

  /* ---------- 阅读标记 ---------- */
  function markRead(id){try{localStorage.setItem("zs_read_"+id,"1");}catch(e){}}
  function isRead(id){try{return !!localStorage.getItem("zs_read_"+id);}catch(e){return false;}}

  /* ---------- 天气画布：密度随滚动变化（data-rain="a>b"） ---------- */
  var density=0,target=0;
  function initWeather(mode){
    var cv=document.getElementById("rain");
    if(!cv)return;
    var cx=cv.getContext("2d");
    var DPR=Math.min(window.devicePixelRatio||1,2);
    var W=0,H=0,parts=[];
    function resize(){
      W=innerWidth;H=innerHeight;
      cv.width=W*DPR;cv.height=H*DPR;
      cv.style.width=W+"px";cv.style.height=H+"px";
      cx.setTransform(DPR,0,0,DPR,0,0);
    }
    resize();addEventListener("resize",resize);

    var sections=[].slice.call(document.querySelectorAll(".scene"));
    var RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
    function weatherTarget(){
      var mid=scrollY+innerHeight*0.55;
      for(var i=0;i<sections.length;i++){
        var s=sections[i],top=s.offsetTop,bot=top+s.offsetHeight;
        if(mid>=top&&mid<bot){
          var v=s.getAttribute("data-rain")||"0";
          var ab=v.split(">"),p=(mid-top)/s.offsetHeight;
          return ab.length>1
            ?(+ab[0])+(+ab[1]-+ab[0])*Math.max(0,Math.min(1,p))
            :+ab[0];
        }
      }
      return 0;
    }
    var ticking=false;
    function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(paint)}}
    function paint(){
      ticking=false;
      target=STATIC?0.55:weatherTarget();
      density+=(target-density)*0.06;   // 雨势平缓过渡，不突兀
    }
    addEventListener("scroll",onScroll,{passive:true});paint();

    var MAX=mode==="snow"?70:110;
    function spawn(){
      if(mode==="snow"){
        parts.push({x:Math.random()*(W+60)-30,y:-8-Math.random()*20,
          r:1.1+Math.random()*1.7,sp:.5+Math.random()*.9,ph:Math.random()*6.28,
          a:.25+Math.random()*.4});
      }else{
        parts.push({x:Math.random()*(W+80)-40,y:-20-Math.random()*40,
          len:9+Math.random()*13,sp:7+Math.random()*5,
          drift:1.4+Math.random()*1.2,a:.10+Math.random()*.16});
      }
    }
    (function frame(){
      cx.clearRect(0,0,W,H);
      if(!RM){
        var want=Math.round(density*MAX);
        while(parts.length<want)spawn();
        if(parts.length>want)parts.length=want;
        if(mode==="snow"){
          for(var i=0;i<parts.length;i++){
            var f=parts[i];
            f.y+=f.sp;f.ph+=0.012;f.x+=Math.sin(f.ph)*0.35;
            cx.fillStyle="rgba(226,232,252,"+(f.a*Math.min(1,density*1.4))+")";
            cx.beginPath();cx.arc(f.x,f.y,f.r,0,6.283);cx.fill();
            if(f.y>H+8){f.y=-8;f.x=Math.random()*(W+60)-30;}
          }
        }else{
          cx.lineWidth=1;cx.lineCap="round";
          for(var j=0;j<parts.length;j++){
            var d=parts[j];
            d.y+=d.sp;d.x+=d.drift*0.4;
            cx.strokeStyle="rgba(190,205,240,"+(d.a*Math.min(1,density*1.4))+")";
            cx.beginPath();
            cx.moveTo(d.x,d.y);
            cx.lineTo(d.x-d.drift*2.2,d.y+d.len);
            cx.stroke();
            if(d.y>H+30){d.y=-20-Math.random()*30;d.x=Math.random()*(W+80)-40;}
          }
        }
      }
      requestAnimationFrame(frame);
    })();
  }

  /* ---------- 钢琴 BGM ---------- */
  var AC=null,master=null,delaySend=null,soundOn=true,started=false;
  function initAudio(cfg){
    var btn=document.getElementById("sndBtn");
    if(btn)btn.classList.add("on");

    function startAudio(){
      if(started)return;started=true;
      try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null;return;}
      master=AC.createGain();master.gain.value=0;master.connect(AC.destination);
      master.gain.setTargetAtTime((soundOn?1:0)*(cfg.volume||1),AC.currentTime+0.1,1.2);

      var delay=AC.createDelay(1.5);delay.delayTime.value=cfg.delayTime||0.46;
      var fb=AC.createGain();fb.gain.value=cfg.feedback||0.32;
      var wet=AC.createGain();wet.gain.value=cfg.wetness||0.5;
      delay.connect(fb);fb.connect(delay);delay.connect(wet);wet.connect(master);
      delaySend=delay;

      function key(f,t,dur,vol){
        var g=AC.createGain();
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(vol,t+0.015);
        g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
        g.connect(master);g.connect(delaySend);
        [[1,1],[2,0.32],[3,0.1]].forEach(function(h){
          var o=AC.createOscillator();
          o.type="sine";o.frequency.value=f*h[0];
          var og=AC.createGain();og.gain.value=h[1];
          o.connect(og);og.connect(g);
          o.start(t);o.stop(t+dur+0.1);
        });
      }

      function playChord(ci,base){
        var c=cfg.chords[ci];
        key(c.bass,base,3.6,0.06);
        for(var i=0;i<c.notes.length;i++){
          if(i===2&&Math.random()<0.25)continue;
          key(c.notes[i],base+0.75+i*0.78+(Math.random()*0.08-0.04),2.4,0.055+Math.random()*0.02);
        }
        if(Math.random()<0.8){
          var s=c.spark[Math.floor(Math.random()*c.spark.length)];
          key(s,base+0.75+c.notes.length*0.78+0.4,2.2,0.034);
        }
      }

      var step=0;
      (function loop(){
        setTimeout(function(){
          if(soundOn&&AC.state==="running"&&document.visibilityState!=="hidden"){
            playChord(step%cfg.chords.length,AC.currentTime+0.05);
            step++;
          }
          loop();
        },cfg.tempo||4000);
      })();
    }

    function tryStart(){
      if(!started)startAudio();
      if(AC&&AC.state==="suspended")AC.resume();
    }
    tryStart();
    document.addEventListener("WeixinJSBridgeReady",tryStart,false);
    if(window.WeixinJSBridge)tryStart();
    var kick=function(){tryStart();};
    document.addEventListener("touchstart",kick,{passive:true});
    document.addEventListener("pointerdown",kick,{passive:true});

    if(btn)btn.addEventListener("click",function(){
      if(!started)startAudio();
      if(AC&&AC.state==="suspended")AC.resume();
      soundOn=!soundOn;
      btn.classList.toggle("on",soundOn);
      if(AC)master.gain.setTargetAtTime((soundOn?1:0)*(cfg.volume||1),AC.currentTime,0.35);
    });
    document.addEventListener("visibilitychange",function(){
      if(!AC)return;
      if(document.hidden){AC.suspend();}
      else if(soundOn){AC.resume();}
    });
  }

  /* ---------- 点灯互动（finale） ---------- */
  function initLighting(f){
    var g=document.querySelector(f.wins);
    if(!g)return;
    var WINS=[];
    f.rows.forEach(function(y,ri){
      f.cols.forEach(function(x,ci){
        var skip=false;
        (f.skip||[]).forEach(function(s){if(s[0]===ri&&s[1]===ci)skip=true;});
        if(skip)return;
        var grp=document.createElementNS("http://www.w3.org/2000/svg","g");
        grp.setAttribute("class","wing");
        var halo=document.createElementNS("http://www.w3.org/2000/svg","rect");
        halo.setAttribute("x",x-4);halo.setAttribute("y",y-4);
        halo.setAttribute("width",40);halo.setAttribute("height",34);
        halo.setAttribute("rx",5);halo.setAttribute("fill","#ffcf7e");
        if(f.glow)halo.setAttribute("filter","url(#"+f.glow+")");
        halo.setAttribute("class","halo");
        var glass=document.createElementNS("http://www.w3.org/2000/svg","rect");
        glass.setAttribute("x",x);glass.setAttribute("y",y);
        glass.setAttribute("width",32);glass.setAttribute("height",26);
        glass.setAttribute("rx",3);glass.setAttribute("class","glass");
        grp.appendChild(halo);grp.appendChild(glass);
        g.appendChild(grp);
        WINS.push(grp);
      });
    });

    var litCount=0;
    var LINES=[].slice.call(document.querySelectorAll(f.lines+" p"));
    function lightOne(win){
      win.classList.add("lit");
      litCount++;
      LINES.forEach(function(p){
        if(+p.getAttribute("data-at")===litCount)p.classList.add("on");
      });
      if(litCount>=WINS.length){
        var roof=document.querySelector(f.roof);
        if(roof)roof.classList.add("on");
        var alllit=document.querySelector(f.alllit);
        if(alllit)alllit.classList.add("on");
        var hint=document.querySelector(f.hint);
        if(hint&&f.hintDone)hint.innerHTML=f.hintDone;
      }
    }
    var wrap=document.querySelector(f.wrap);
    if(wrap)wrap.addEventListener("pointerdown",function(e){
      var t=e.target.closest?e.target.closest(".wing"):null;
      if(t&&!t.classList.contains("lit")){lightOne(t);return;}
      var un=WINS.filter(function(w){return !w.classList.contains("lit")});
      if(un.length)lightOne(un[Math.floor(Math.random()*un.length)]);
    });
    if(qs.get("lit")==="all")WINS.forEach(function(w){lightOne(w)});
  }

  /* ---------- 入口 ---------- */
  function init(opts){
    opts=opts||{};
    var sections=[].slice.call(document.querySelectorAll(".scene"));

    var ONLY=qs.get("only");   // 截图调试：只显示某一幕
    if(ONLY)sections.forEach(function(s){if(s.id!==ONLY)s.style.display="none"});

    if(STATIC){
      document.body.classList.add("static");
      sections.forEach(function(s){s.classList.add("in")});
    }else{
      var io=new IntersectionObserver(function(es){
        es.forEach(function(en){
          if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target);}
        });
      },{threshold:.22});
      sections.forEach(function(s){io.observe(s)});
    }

    if(opts.weather)initWeather(opts.weather);
    if(opts.audio)initAudio(opts.audio);
    if(opts.finale)initLighting(opts.finale);

    if(opts.storyId){   // 读完（页脚出现）就点亮书房里属于这夜的窗
      var footer=document.querySelector("footer")||sections[sections.length-1];
      if(footer){
        var rio=new IntersectionObserver(function(es){
          es.forEach(function(en){
            if(en.isIntersecting){markRead(opts.storyId);rio.disconnect();}
          });
        },{threshold:.35});
        rio.observe(footer);
      }
    }
  }

  return {init:init,isRead:isRead,markRead:markRead};
})();
