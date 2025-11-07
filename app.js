(function(){
  const $ = s => document.querySelector(s);

  // Signature Pad with Undo and white ink
  function SignaturePad(canvas){
    const ctx = canvas.getContext('2d');
    let D = Math.max(1, window.devicePixelRatio || 1);
    let drawing = false, last = null;
    const strokes = [];

    function applyStyle(){ ctx.setTransform(D,0,0,D,0,0); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=2; ctx.strokeStyle='#fff'; }
    function resize(){ const r=canvas.getBoundingClientRect(); canvas.width=Math.round(r.width*D); canvas.height=Math.round(r.height*D); applyStyle(); redraw(); }
    function p(e){ const r=canvas.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return {x:t.clientX-r.left,y:t.clientY-r.top}; }
    function redraw(){ ctx.clearRect(0,0,canvas.width,canvas.height); applyStyle(); for(const path of strokes){ if(path.length<2) continue; ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y); for(let i=1;i<path.length;i++){ ctx.lineTo(path[i].x,path[i].y); } ctx.stroke(); } }
    function down(e){ e.preventDefault(); drawing=true; last=p(e); strokes.push([last]); }
    function move(e){ if(!drawing) return; const pt=p(e); strokes[strokes.length-1].push(pt); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(pt.x,pt.y); ctx.stroke(); last=pt; }
    function up(){ drawing=false; last=null; }

    canvas.addEventListener('pointerdown',down,{passive:false});
    canvas.addEventListener('pointermove',move,{passive:false});
    window.addEventListener('pointerup',up);
    new ResizeObserver(resize).observe(canvas);
    resize();

    return { clear(){strokes.length=0;redraw();}, undo(){strokes.pop();redraw();}, hasInk(){return strokes.length>0;}, toDataURL(){return this.hasInk()?canvas.toDataURL('image/png'):'';} };
  }

  const initialsPad = SignaturePad($('#initialsCanvas'));
  const signaturePad = SignaturePad($('#signatureCanvas'));
  $('#clearInitials').onclick=()=>initialsPad.clear();
  $('#clearSignature').onclick=()=>signaturePad.clear();
  $('#undoInitials').onclick=()=>initialsPad.undo();
  $('#undoSignature').onclick=()=>signaturePad.undo();

  // Anniversary date
  const startInput=$('#startDate'), annDisplay=$('#annDisplay');
  function ann(d){ if(!d) return ''; const dt=new Date(d); if(isNaN(dt)) return ''; const a=new Date(dt.getFullYear()+1,dt.getMonth(),dt.getDate()); const z=n=>String(n).padStart(2,'0'); return a.getFullYear()+'-'+z(a.getMonth()+1)+'-'+z(a.getDate()); }
  if(startInput){ startInput.addEventListener('change',()=>{ annDisplay.value=ann(startInput.value); }); }

  // Permit conditionals
  const citizen=$('#citizenSA'), permWrap=$('#permitValidWrap'), expWrap=$('#permitExpiryWrap'), permSel=$('#workPermitValid'), exp=$('#workPermitExpiry');
  function updatePermit(){ const noSA=citizen && citizen.value.toLowerCase().startsWith('n'); permWrap.style.display=noSA?'':'none'; expWrap.style.display=(noSA && permSel && permSel.value.toLowerCase().startsWith('y'))?'':'none'; if(noSA){ permSel.setAttribute('required','required'); if(permSel.value.toLowerCase().startsWith('y')){ exp.setAttribute('required','required'); }else{ exp.removeAttribute('required'); exp.value=''; } } else { permSel.removeAttribute('required'); permSel.value=''; exp.removeAttribute('required'); exp.value=''; } }
  if(citizen){ citizen.addEventListener('change',updatePermit); }
  if(permSel){ permSel.addEventListener('change',updatePermit); }
  updatePermit();

  // FFC conditional block
  const ffcHold=$('#ffcHold'), ffcFields=$('#ffcFields');
  function updateFFC(){ const noFFC=ffcHold && ffcHold.value.toLowerCase().startsWith('n'); ffcFields.style.display=noFFC?'none':''; if(noFFC){ ffcFields.querySelectorAll('input,select,textarea').forEach(el=>{ el.value=''; el.removeAttribute('required'); }); } }
  if(ffcHold){ ffcHold.addEventListener('change',updateFFC); }
  updateFFC();

  // Submit
  const form=$('#joinForm'), statusEl=$('#status'), btn=$('#submitBtn');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!$('#readAck').checked){ alert('Please confirm you have read the agreement.'); return; }
    const i=initialsPad.toDataURL(), s=signaturePad.toDataURL();
    if(!i){ alert('Please draw your initials.'); return; }
    if(!s){ alert('Please provide your full signature.'); return; }

    statusEl.className='success'; statusEl.textContent='Submitting… please wait.'; statusEl.classList.remove('hide'); btn.disabled=true;

    const data=Object.fromEntries(new FormData(form).entries());
    data.agree=!!data.agree; data.readAck=true; data.initialsDataUrl=i; data.signatureDataUrl=s;

    try{
      const res = await fetch(window.KWX_CONFIG.API_ENDPOINT, { method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8'}, body: JSON.stringify(data) });
      let out=null; try{ out=await res.json(); }catch(_){ out=null; }
      if(out && out.ok){
        statusEl.className='success';
        statusEl.innerHTML='<b>Done!</b> <a target="_blank" href="'+out.pdfUrl+'">Open PDF</a>'
          +(out.folderUrl?' · <a target="_blank" href="'+out.folderUrl+'">Folder</a>':'')
          +(out.sheetUrl?' · <a target="_blank" href="'+out.sheetUrl+'">Responses</a>':'');
        form.reset(); annDisplay.value=''; initialsPad.clear(); signaturePad.clear(); updatePermit(); updateFFC();
      }else{
        statusEl.className='success';
        statusEl.innerHTML='<b>Submitted!</b> If a PDF link is not shown, please check your email for the document.';
      }
    }catch(err){
      statusEl.className='note'; statusEl.textContent = err && err.message ? err.message : 'Submission failed. Please try again.';
    }finally{
      btn.disabled=false;
    }
  });
})();