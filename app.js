(function(){
  const $ = s => document.querySelector(s);

  function makePad(id){
    const c=$(id),x=c.getContext('2d'),D=Math.max(1,window.devicePixelRatio||1);
    function rs(){const r=c.getBoundingClientRect();c.width=Math.round(r.width*D);c.height=Math.round(r.height*D);x.setTransform(D,0,0,D,0,0);x.lineCap='round';x.lineJoin='round';x.lineWidth=2;x.strokeStyle='#111'}
    rs(); new ResizeObserver(rs).observe(c);
    let d=false,drawn=false,last=null;
    const P=e=>{const r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return {x:t.clientX-r.left,y:t.clientY-r.top}};
    const down=e=>{e.preventDefault();d=true;drawn=true;last=P(e)},
          move=e=>{if(!d)return;const p=P(e);x.beginPath();x.moveTo(last.x,last.y);x.lineTo(p.x,p.y);x.stroke();last=p},
          up=()=>d=false;
    c.addEventListener('mousedown',down);c.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
    c.addEventListener('touchstart',down,{passive:false});c.addEventListener('touchmove',move,{passive:false});c.addEventListener('touchend',up);
    return {clear(){x.clearRect(0,0,c.width,c.height);drawn=false},toDataURL(){return drawn?c.toDataURL('image/png'):''}}
  }

  const initialsPad=makePad('#initialsCanvas'), signaturePad=makePad('#signatureCanvas');
  $('#clearInitials').onclick=()=>initialsPad.clear();
  $('#clearSignature').onclick=()=>signaturePad.clear();

  const startInput=document.querySelector('input[name="startDate"]'), annDisplay=document.getElementById('annDisplay');
  function ann(d){if(!d)return'';const dt=new Date(d);if(isNaN(dt))return'';const a=new Date(dt.getFullYear()+1,dt.getMonth(),dt.getDate());const z=n=>String(n).padStart(2,'0');return a.getFullYear()+'-'+z(a.getMonth()+1)+'-'+z(a.getDate())}
  startInput.addEventListener('change',()=>{annDisplay.value=ann(startInput.value)});

  const form=$('#joinForm'), statusEl=$('#status'), btn=$('#submitBtn');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!$('#readAck').checked){alert('Please confirm you have read the agreement.');return}
    const i=initialsPad.toDataURL(), s=signaturePad.toDataURL();
    if(!i){alert('Please draw your initials.');return}
    if(!s){alert('Please provide your full signature.');return}
    statusEl.className='success';statusEl.textContent='Submitting… please wait.';statusEl.classList.remove('hide');btn.disabled=true;
    const data=Object.fromEntries(new FormData(form).entries());
    data.agree=!!data.agree; data.readAck=true; data.initialsDataUrl=i; data.signatureDataUrl=s;

    try{
      const res = await fetch(window.KWX_CONFIG.API_ENDPOINT, {
        method:'POST',
        mode: window.KWX_CONFIG.CORS_MODE || 'cors',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });

      let out=null;
      try{ out = await res.json(); }catch(_){ out=null; }

      if(out && out.ok){
        statusEl.className='success';
        statusEl.innerHTML='<b>Done!</b> <a target="_blank" href="'+out.pdfUrl+'">Open PDF</a>'
            +(out.folderUrl?' · <a target="_blank" href="'+out.folderUrl+'">Folder</a>':'')
            +(out.sheetUrl?' · <a target="_blank" href="'+out.sheetUrl+'">Responses</a>':'');
        form.reset(); annDisplay.value=''; initialsPad.clear(); signaturePad.clear();
      }else{
        statusEl.className='note';
        statusEl.textContent='Submitted. If you did not receive an email, please contact the office. (Tip: enable CORS + JSON response on backend.)';
      }
    }catch(err){
      statusEl.className='note';
      statusEl.textContent = err && err.message ? err.message : 'Submission failed. Please try again.';
    }finally{
      btn.disabled=false;
    }
  });
})();