'use strict';
(() => {
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
function bindCursorHover(){
  document.addEventListener('mousemove', e => {
    const active = e.target instanceof Element && !!e.target.closest('a, button, input, textarea, select, .law-card');
    document.body.classList.toggle('cursor-hover', active);
  }, {passive:true});
}
function initCursor() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = $('#cursorDot');
  const ring = $('#cursorRing');
  const glow = $('#cursorGlow');
  if (!dot || !ring || !glow) return;

  let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
  let dotX = mouseX, dotY = mouseY;
  let ringX = mouseX, ringY = mouseY;
  let glowX = mouseX, glowY = mouseY;

  addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  }, { passive:true });
  addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
  addEventListener('mouseenter', () => document.body.classList.add('cursor-active'));

  const frame = () => {
    dotX += (mouseX - dotX) * .46;
    dotY += (mouseY - dotY) * .46;
    ringX += (mouseX - ringX) * .135;
    ringY += (mouseY - ringY) * .135;
    glowX += (mouseX - glowX) * .045;
    glowY += (mouseY - glowY) * .045;
    dot.style.transform = `translate3d(${dotX}px,${dotY}px,0)`;
    ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
    glow.style.transform = `translate3d(${glowX}px,${glowY}px,0)`;
    requestAnimationFrame(frame);
  };
  frame();
  bindCursorHover();
}


function initDragScroll() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;

  let dragging = false;
  let moved = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let lastTime = 0;
  let lastMoveTime = 0;
  let velocity = 0;          // px/ms, положительное значение = прокрутка вниз
  let inertiaFrame = 0;
  let suppressClick = false;

  const interactiveSelector = 'a, button, input, textarea, select, [contenteditable="true"], .site-scrollbar-thumb';
  const root = document.documentElement;

  const maxScroll = () => Math.max(0, root.scrollHeight - innerHeight);

  const setKineticState = enabled => {
    root.classList.toggle('page-kinetic', enabled);
    document.body.classList.toggle('page-kinetic', enabled);
  };

  const cancelInertia = () => {
    if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
    velocity = 0;
    if (!dragging) setKineticState(false);
  };
  window.cancelPageInertia = cancelInertia;

  const beginInertia = () => {
    if (inertiaFrame) cancelAnimationFrame(inertiaFrame);

    const idleFor = performance.now() - lastMoveTime;
    if (idleFor > 85) velocity *= Math.max(0, 1 - (idleFor - 85) / 150);

    velocity = Math.max(-2.7, Math.min(2.7, velocity * 1.22));
    if (Math.abs(velocity) < .055) {
      setKineticState(false);
      return;
    }

    setKineticState(true);
    let previous = performance.now();
    const tick = now => {
      const dt = Math.min(32, Math.max(1, now - previous));
      previous = now;

      const before = scrollY;
      const limit = maxScroll();
      const next = Math.max(0, Math.min(limit, before + velocity * dt));
      window.scrollTo(0, next);

      velocity *= Math.pow(.946, dt / 16.667);

      if (next <= 0 || next >= limit) velocity *= .34;

      if (Math.abs(velocity) > .014) {
        inertiaFrame = requestAnimationFrame(tick);
      } else {
        inertiaFrame = 0;
        velocity = 0;
        setKineticState(false);
      }
    };
    inertiaFrame = requestAnimationFrame(tick);
  };

  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest(interactiveSelector)) return;

    cancelInertia();
    dragging = true;
    moved = false;
    suppressClick = false;
    startY = lastY = e.clientY;
    startScroll = scrollY;
    lastTime = lastMoveTime = performance.now();
    velocity = 0;

    root.classList.add('page-dragging');
    document.body.classList.add('page-dragging');
    setKineticState(true);
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;

    const now = performance.now();
    const dyFromStart = e.clientY - startY;
    if (Math.abs(dyFromStart) > 3) moved = true;

    const nextScroll = Math.max(0, Math.min(maxScroll(), startScroll - dyFromStart));
    window.scrollTo(0, nextScroll);

    const dt = Math.max(1, now - lastTime);
    const instantVelocity = (lastY - e.clientY) / dt;

    velocity = velocity * .58 + instantVelocity * .42;
    lastY = e.clientY;
    lastTime = now;
    lastMoveTime = now;

    e.preventDefault();
  }, { passive:false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('page-dragging');
    document.body.classList.remove('page-dragging');

    if (moved) {
      suppressClick = true;
      beginInertia();
      setTimeout(() => { suppressClick = false; }, 110);
    } else {
      setKineticState(false);
    }
  };

  window.addEventListener('mouseup', finish);
  window.addEventListener('blur', finish);

  document.addEventListener('click', e => {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
  }, true);

  const wheelCanUseOwnScroller = (target, deltaY) => {
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body && node !== root) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      const scrollable = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1;
      if (scrollable) {
        const canUp = node.scrollTop > 0;
        const canDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
        if ((deltaY < 0 && canUp) || (deltaY > 0 && canDown)) return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const normalizeWheelDelta = e => {
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= innerHeight;
    return Math.max(-190, Math.min(190, delta));
  };

  const startWheelInertia = () => {
    if (inertiaFrame) return;
    setKineticState(true);

    let previous = performance.now();
    const tick = now => {
      const dt = Math.min(32, Math.max(1, now - previous));
      previous = now;

      const limit = maxScroll();
      const before = scrollY;
      const next = Math.max(0, Math.min(limit, before + velocity * dt));
      window.scrollTo(0, next);

      velocity *= Math.pow(.885, dt / 16.667);
      if (next <= 0 || next >= limit) velocity *= .28;

      if (Math.abs(velocity) > .012) {
        inertiaFrame = requestAnimationFrame(tick);
      } else {
        inertiaFrame = 0;
        velocity = 0;
        setKineticState(false);
      }
    };
    inertiaFrame = requestAnimationFrame(tick);
  };

  window.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || dragging) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (wheelCanUseOwnScroller(e.target, e.deltaY)) return;

    e.preventDefault();

    const delta = normalizeWheelDelta(e);
    velocity += delta * .0078;
    velocity = Math.max(-3.4, Math.min(3.4, velocity));
    startWheelInertia();
  }, { passive:false });

  window.addEventListener('keydown', cancelInertia);
  document.addEventListener('mousedown', () => {
    if (!dragging && inertiaFrame) cancelInertia();
  }, true);
}


function initCustomScrollbar() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;

  const track = document.createElement('div');
  track.className = 'site-scrollbar';
  track.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('div');
  thumb.className = 'site-scrollbar-thumb';
  track.appendChild(thumb);
  document.body.appendChild(track);

  let dragging = false;
  let grabOffset = 0;

  const metrics = () => {
    const doc = document.documentElement;
    const viewport = innerHeight;
    const total = Math.max(doc.scrollHeight, viewport);
    const trackHeight = track.clientHeight;
    const minThumb = 52;
    const thumbHeight = Math.max(minThumb, Math.min(trackHeight, trackHeight * (viewport / total)));
    const maxScroll = Math.max(0, total - viewport);
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    return { thumbHeight, maxScroll, maxThumbTop };
  };

  const sync = () => {
    const { thumbHeight, maxScroll, maxThumbTop } = metrics();
    const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${maxThumbTop * ratio}px, 0)`;
    track.classList.toggle('hidden', maxScroll <= 0);
  };

  const moveThumb = clientY => {
    const rect = track.getBoundingClientRect();
    const { maxScroll, maxThumbTop } = metrics();
    if (maxScroll <= 0 || maxThumbTop <= 0) return;
    const top = Math.max(0, Math.min(maxThumbTop, clientY - rect.top - grabOffset));
    window.scrollTo(0, (top / maxThumbTop) * maxScroll);
  };

  thumb.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.cancelPageInertia === 'function') window.cancelPageInertia();
    const rect = thumb.getBoundingClientRect();
    grabOffset = e.clientY - rect.top;
    dragging = true;
    thumb.classList.add('dragging');
    thumb.setPointerCapture?.(e.pointerId);
  });

  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    moveThumb(e.clientY);
  }, { passive:false });

  const finish = e => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('dragging');
    try { thumb.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('scroll', sync, { passive:true });
  window.addEventListener('resize', sync, { passive:true });

  sync();
}


function initProgramSort(){
  const native=$('#sortSelect');
  if(!native || native.nextElementSibling?.classList.contains('program-select')) return;
  const wrap=document.createElement('div');
  wrap.className='program-select';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='program-select-trigger interactive';
  trigger.setAttribute('aria-label','Сортировка статей');
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  const value=document.createElement('span');
  value.className='program-select-value';
  const arrow=document.createElement('span');
  arrow.className='program-select-arrow';
  arrow.setAttribute('aria-hidden','true');
  trigger.append(value,arrow);
  const dropdown=document.createElement('div');
  dropdown.className='program-select-dropdown';
  const options=document.createElement('div');
  options.className='program-select-options';
  options.id='law-sort-options';
  options.setAttribute('role','listbox');
  options.setAttribute('aria-label','Порядок статей');
  dropdown.appendChild(options);
  wrap.append(trigger,dropdown);
  trigger.setAttribute('aria-controls',options.id);
  native.classList.add('animated-native-select');
  native.tabIndex=-1;
  native.insertAdjacentElement('afterend',wrap);
  const list=[];
  function sync(){
    const selected=native.options[native.selectedIndex]||native.options[0];
    value.textContent=selected?.textContent||'Сортировка';
    list.forEach(btn=>{
      const chosen=btn.dataset.value===native.value;
      btn.classList.toggle('selected',chosen);
      btn.setAttribute('aria-selected',String(chosen));
    });
  }
  function toggle(open){
    wrap.classList.toggle('open',open);
    trigger.setAttribute('aria-expanded',String(open));
    options.querySelectorAll('button').forEach(btn=>{btn.tabIndex=open?0:-1});
  }
  function pick(index){
    const button=list[index];
    if(!button || button.disabled)return;
    native.value=button.dataset.value;
    native.dispatchEvent(new Event('change',{bubbles:true}));
    sync();toggle(false);trigger.focus();
  }
  [...native.options].forEach((option,index)=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='program-select-option';
    btn.setAttribute('role','option');
    btn.dataset.value=option.value;
    btn.textContent=option.textContent;
    btn.style.setProperty('--option-index',index);
    btn.disabled=option.disabled;
    btn.tabIndex=-1;
    btn.addEventListener('click',()=>pick(index));
    btn.addEventListener('keydown',e=>{
      let next=null;
      if(e.key==='ArrowDown')next=(index+1)%list.length;
      else if(e.key==='ArrowUp')next=(index+list.length-1)%list.length;
      else if(e.key==='Home')next=0;
      else if(e.key==='End')next=list.length-1;
      else if(e.key==='Escape'){e.preventDefault();toggle(false);trigger.focus();return;}
      if(next!==null){e.preventDefault();list[next].focus();}
    });
    list.push(btn);options.appendChild(btn);
  });
  native.addEventListener('change',sync);
  trigger.addEventListener('click',()=>toggle(!wrap.classList.contains('open')));
  trigger.addEventListener('keydown',e=>{
    if(e.key==='Escape'){toggle(false);return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();toggle(true);
      const idx=Math.max(0,native.selectedIndex);
      list[e.key==='ArrowDown'?(idx+1)%list.length:(idx+list.length-1)%list.length].focus();
    }
  });
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))toggle(false)});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&wrap.classList.contains('open')){toggle(false);trigger.focus();}
  });
  sync();
}
initProgramSort();

function initReveals(){
  const elements=$$('.reveal');
  if (!('IntersectionObserver' in window)) { elements.forEach(el=>el.classList.add('visible')); return; }
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}
    });
  },{threshold:.09,rootMargin:'0px 0px -6% 0px'});
  elements.forEach(el=>observer.observe(el));
}
initReveals();
const header=$('#topbar');
const syncHeader=()=>header?.classList.toggle('scrolled',scrollY>18);
window.addEventListener('scroll',syncHeader,{passive:true});
syncHeader();
initCursor();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches){
  initDragScroll();
  initCustomScrollbar();
}
})();
