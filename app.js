const SUPABASE_URL="https://jdnfntllvjzkxxqxvtmw.supabase.co";
const SUPABASE_KEY="sb_publishable_tDhnxNCLFiWJivBSFwAIlQ_maqe_9o4";
const {createClient}=window.supabase;
const db=createClient(SUPABASE_URL,SUPABASE_KEY);

const nights=[...Array(9)].map((_,i)=>({id:i+1,date:["Oct 11","Oct 12","Oct 13","Oct 14","Oct 15","Oct 16","Oct 17","Oct 18","Oct 19"][i]}));
const nightsEl=document.getElementById("nights");
nights.forEach(n=>{const l=document.createElement("label");l.className="chip";l.innerHTML='<input type="checkbox" name="night" value="'+n.id+'"> Night '+n.id+' · '+n.date;l.querySelector("input").addEventListener("change",()=>l.classList.toggle("selected",l.querySelector("input").checked));nightsEl.appendChild(l)});

const form=document.getElementById("profileForm"), authForm=document.getElementById("authForm"), authStatus=document.getElementById("authStatus");
function val(id){return document.getElementById(id).value}
function setStatus(msg){authStatus.textContent=msg}
function selectedNights(){return [...document.querySelectorAll('input[name="night"]:checked')].map(x=>+x.value)}

async function signUp(){
 const email=val("email"),password=val("password");
 const {error}=await db.auth.signUp({email,password});
 if(error){setStatus(error.message);return}
 setStatus("Account created. If email confirmation is enabled, check your inbox, then sign in.");
}
async function signIn(){
 const email=val("email"),password=val("password");
 const {error}=await db.auth.signInWithPassword({email,password});
 if(error){setStatus(error.message);return}
 setStatus("Signed in.");
 await loadProfile();
}
authForm.addEventListener("submit",e=>{e.preventDefault();signUp()});
document.getElementById("loginBtn").addEventListener("click",signIn);

form.addEventListener("submit",async e=>{
 e.preventDefault();
 const {data:{user}}=await db.auth.getUser();
 if(!user){alert("Please create an account or sign in first.");location.hash="auth";return}
 const selected=selectedNights();
 if(!selected.length){alert("Select at least one Navratri night.");return}
 if(+val("age")<18){alert("This platform is 18+ only.");return}
 const profile={id:user.id,name:val("name"),age:+val("age"),gender:val("gender"),looking_for:val("lookingFor"),dance_type:val("dance"),skill_level:val("level"),tempo:val("tempo"),area:val("area"),bio:""};
 const {error}=await db.from("profiles").upsert(profile);
 if(error){alert(error.message);return}
 const {data:nightRows}=await db.from("nights").select("id,night_number").in("night_number",selected);
 await db.from("profile_nights").delete().eq("profile_id",user.id);
 const rows=(nightRows||[]).map(n=>({profile_id:user.id,night_id:n.id}));
 if(rows.length) await db.from("profile_nights").insert(rows);
 await loadProfile(); location.hash="matches";
});

async function loadProfile(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){document.getElementById("profile").classList.add("hidden");return}
 document.getElementById("profile").classList.remove("hidden");
 const {data:p}=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(!p)return;
 document.getElementById("name").value=p.name||"";
 document.getElementById("age").value=p.age||"";
 document.getElementById("gender").value=p.gender||"";
 document.getElementById("lookingFor").value=p.looking_for||"";
 document.getElementById("dance").value=p.dance_type||"Dandiya";
 document.getElementById("level").value=p.skill_level||"Beginner";
 document.getElementById("tempo").value=p.tempo||"Medium";
 document.getElementById("area").value=p.area||"Baramati City";
 const {data:pn}=await db.from("profile_nights").select("night_id,nights(night_number)").eq("profile_id",user.id);
 const ids=(pn||[]).map(x=>x.nights?.night_number);
 document.querySelectorAll('input[name="night"]').forEach(x=>{x.checked=ids.includes(+x.value);x.closest(".chip").classList.toggle("selected",x.checked)});
 await renderMatches(p);
}

async function renderMatches(p){
 const {data:rows,error}=await db.from("profiles").select("id,name,age,gender,looking_for,dance_type,skill_level,tempo,area").neq("id",p.id).limit(60);
 if(error){document.getElementById("matchSummary").textContent=error.message;return}
 const {data:myNights}=await db.from("profile_nights").select("night_id,nights(night_number)").eq("profile_id",p.id);
 const mine=(myNights||[]).map(x=>x.nights?.night_number);
 const ids=(rows||[]).map(x=>x.id);
 const {data:pn}=ids.length?await db.from("profile_nights").select("profile_id,night_id,nights(night_number)").in("profile_id",ids):{data:[]};
 const by=new Map();(pn||[]).forEach(x=>{if(!by.has(x.profile_id))by.set(x.profile_id,[]);by.get(x.profile_id).push(x.nights?.night_number)});
 const list=(rows||[]).map(x=>({...x,nights:by.get(x.id)||[],score:score(p,{...x,nights:by.get(x.id)||[]})})).sort((a,b)=>b.score-a.score);
 document.querySelector(".matches-section").classList.remove("hidden");
 document.getElementById("matchSummary").textContent="Real Baramati profiles ranked by shared nights, dance style, level, tempo and area.";
 document.getElementById("matchGrid").innerHTML=list.length?list.map(x=>'<article class="match-card"><div class="avatar">'+(x.name||"?")[0].toUpperCase()+'</div><h3>'+escapeHtml(x.name)+', '+x.age+'</h3><div class="score">'+x.score+'% compatibility</div><div class="tags"><span class="tag">'+x.dance_type+'</span><span class="tag">'+x.skill_level+'</span><span class="tag">'+x.tempo+'</span><span class="tag">'+x.area+'</span></div><p>Available Night '+x.nights.join(", ")+'</p><button onclick="likeProfile(\''+x.id+'\')">Like & Connect</button></article>').join(""):'<p>No other profiles yet. Share the site with people in Baramati to start building the community.</p>';
}
function score(a,b){let s=0;s+=(b.nights||[]).filter(n=>mineNight(a,n)).length*8;if(a.dance_type===b.dance_type)s+=22;else if(a.dance_type==="Both"||b.dance_type==="Both")s+=15;if(a.skill_level===b.skill_level)s+=18;else if(Math.abs(["Beginner","Intermediate","Advanced"].indexOf(a.skill_level)-["Beginner","Intermediate","Advanced"].indexOf(b.skill_level))===1)s+=9;if(a.tempo===b.tempo)s+=14;else if(a.tempo==="Medium"||b.tempo==="Medium")s+=7;if(a.area===b.area)s+=10;return Math.min(99,s)}
function mineNight(a,n){return a._nights?a._nights.includes(n):selectedNights().includes(n)}
async function likeProfile(id){
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {error}=await db.from("likes").insert({liker_id:user.id,liked_id:id});
 if(error&&error.code!=="23505"){alert(error.message);return}
 const {data:mutual}=await db.from("matches").select("id").or("user_a.eq."+user.id+",user_b.eq."+user.id);
 const found=(mutual||[]).some(m=>m.id);
 if(found) alert("Like sent. Check your Matches — a mutual match may now be available.");
 else alert("Like sent. If they like you back, you will get a mutual match.");
 await loadProfile();
}
async function loadMatches(){
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {data:matches}=await db.from("matches").select("id,user_a,user_b,created_at").or("user_a.eq."+user.id+",user_b.eq."+user.id);
 const box=document.getElementById("matchGrid");
 if(!matches?.length)return;
 const ids=matches.map(m=>m.user_a===user.id?m.user_b:m.user_a);
 const {data:people}=await db.from("profiles").select("id,name,age,dance_type,area").in("id",ids);
 const cards=(people||[]).map(p=>{const m=matches.find(x=>x.user_a===p.id||x.user_b===p.id);return '<article class="match-card"><div class="avatar">'+p.name[0].toUpperCase()+'</div><h3>'+escapeHtml(p.name)+', '+p.age+'</h3><div class="score">💚 Mutual match</div><div class="tags"><span class="tag">'+p.dance_type+'</span><span class="tag">'+p.area+'</span></div><button onclick="openChat(\''+m.id+'\',\''+escapeHtml(p.name)+'\')">Open chat</button></article>'}).join("");
 box.innerHTML=cards+box.innerHTML;
}
async function openChat(matchId,name){
 const body=prompt("Message "+name+" — keep the first meeting at a public event venue:");
 if(!body?.trim())return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {error}=await db.from("messages").insert({match_id:matchId,sender_id:user.id,body:body.trim()});
 if(error){alert(error.message);return}
 alert("Message sent.");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

document.getElementById("resetBtn").addEventListener("click",()=>location.hash="profile");
(async()=>{const {data:{session}}=await db.auth.getSession();if(session)await loadProfile()})();
