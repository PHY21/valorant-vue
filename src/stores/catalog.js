import {defineStore} from 'pinia'
import {computed,ref,watch} from 'vue'
import {readSaved} from '../lib/storage'
export const useCatalog=defineStore('catalog',()=>{
 const data=ref(null),loading=ref(false),error=ref(''),storageError=ref('')
 let saved
 try {saved=readSaved(localStorage.getItem('atlas-v1'))} catch {saved=readSaved(null)}
 const favorites=ref(saved.favorites),comments=ref(saved.comments)
 watch([favorites,comments],()=>{try{localStorage.setItem('atlas-v1',JSON.stringify({favorites:favorites.value,comments:comments.value}));storageError.value=''}catch{storageError.value='浏览器未允许保存，本次操作仅在当前页面有效。'}},{deep:true})
 async function load(){loading.value=true;error.value='';try{const r=await fetch(`${import.meta.env.BASE_URL}data/catalog.json`);if(!r.ok)throw Error();data.value=await r.json()}catch{error.value='数据暂时无法加载，请检查网络后重试。'}finally{loading.value=false}}
 const players=computed(()=>data.value?.player.map(p=>{const t=data.value.team.find(t=>t.team_id===p.team_id);const r=data.value.region.find(r=>r.region_id===t?.region_id);return {...p,team_tag:t?.team_tag||'自由选手',region_code:r?.region_code||'其他'}})||[])
 function toggle(id){favorites.value=favorites.value.includes(id)?favorites.value.filter(x=>x!==id):[...favorites.value,id]}
 function addComment(c){comments.value.unshift({...c,id:crypto.randomUUID(),date:new Date().toISOString()})}
 function removeComment(id){comments.value=comments.value.filter(c=>c.id!==id)}
 return {data,players,loading,error,load,favorites,comments,toggle,addComment,removeComment,storageError}
})
