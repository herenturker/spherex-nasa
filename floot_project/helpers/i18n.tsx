import React,{createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {translateTurkish,translateEnglish} from './locale-phrases';
export type Language='en'|'tr';
const Context=createContext<{language:Language;setLanguage:(v:Language)=>void;t:(s:string)=>string}>({
  language:'en',setLanguage:()=>{},t:(s)=>translateTurkish(s)
});
export const useLanguage=()=>useContext(Context);
export function translated(s:string,language:Language,sourceLanguage:Language='tr'){
  if(language===sourceLanguage)return s;
  return language==='en'?translateTurkish(s):translateEnglish(s);
}

/**
 * App-wide localization boundary.
 * In addition to explicit translated properties, observes React's DOM text
 * changes (including live log entries, labels, aria text and option nodes).
 * Stores every original node value, so switching back to Turkish is lossless.
 * Scientific numbers, source URLs and data are never machine translated.
 */
function LocalizeRuntime({language}:{language:Language}){
  const originalsRef=useRef(new WeakMap<Text,{source:string;rendered:string}>());
  const attrsRef=useRef(new WeakMap<Element,Map<string,{source:string;rendered:string}>>());
  useLayoutEffect(()=>{
    const originals=originalsRef.current;
    const attrs=attrsRef.current;
    const attrNames=['aria-label','title','placeholder','alt'];
    const localizeText=(node:Text)=>{
      if(node.parentElement?.closest('[data-no-translate]'))return;
      const current=node.nodeValue??'';
      let item=originals.get(node);
      if(!item||current!==item.rendered){item={source:current,rendered:current};originals.set(node,item)}
      const next=translated(item.source,language,node.parentElement?.closest('[data-i18n-source="en"]')?'en':'tr');
      if(next!==current)node.nodeValue=next;
      item.rendered=next;
    };
    const localizeAttrs=(el:Element)=>{
      if(el.closest('[data-no-translate]'))return;
      let data=attrs.get(el);if(!data){data=new Map();attrs.set(el,data)}
      for(const key of attrNames){
        const value=el.getAttribute(key);if(value===null)continue;
        let item=data.get(key);
        if(!item||item.rendered!==value){item={source:value,rendered:value};data.set(key,item)}
        const next=translated(item.source,language,el.closest('[data-i18n-source="en"]')?'en':'tr');
        if(next!==value)el.setAttribute(key,next);
        item.rendered=next;
      }
    };
    const traverse=(root:Node)=>{
      if(root.nodeType===Node.TEXT_NODE){localizeText(root as Text);return}
      if(root.nodeType!==Node.ELEMENT_NODE)return;
      const el=root as Element;
      if(el.closest('[data-no-translate]'))return;
      localizeAttrs(el);
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())localizeText(walker.currentNode as Text);
      el.querySelectorAll('*').forEach(localizeAttrs);
    };
    const update=()=>document.querySelectorAll('[data-i18n-root]').forEach(traverse);
    update();
    const observer=new MutationObserver(records=>{
      for(const record of records){
        const node=record.target as Node;
        if(node.nodeType===Node.TEXT_NODE){
          if(node.parentElement?.closest('[data-i18n-root]'))localizeText(node as Text);
        }else if(node.nodeType===Node.ELEMENT_NODE){
          const el=node as Element;
          if(el.matches('[data-i18n-root]')||el.closest('[data-i18n-root]')){
            if(record.type==='attributes')localizeAttrs(el);
            else record.addedNodes.forEach(traverse);
          }else if(record.type==='childList'){
            record.addedNodes.forEach(n=>{
              if(n.nodeType===Node.ELEMENT_NODE&&(n as Element).matches('[data-i18n-root]'))traverse(n);
            });
          }
        }
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,
      attributes:true,attributeFilter:attrNames});
    return()=>observer.disconnect();
  },[language]);
  useEffect(()=>{document.documentElement.lang=language},[language]);
  return null;
}
export function LanguageProvider({children}:{children:React.ReactNode}){
  const [language,setLanguage]=useState<Language>(()=>{
    if(typeof window==='undefined')return 'en';
    try{
      const selected=new URLSearchParams(window.location.search).get('lang');
      if(selected==='tr'||selected==='en')return selected;
      return window.location.pathname==='/tr'||window.localStorage.getItem('spherex-language')==='tr'?'tr':'en'
    }catch{return 'en'}
  });
  const choose=(v:Language)=>{
    setLanguage(v);
    try{window.localStorage.setItem('spherex-language',v)}catch{}
  };
  const value=useMemo(()=>({language,setLanguage:choose,t:(s:string)=>translated(s,language)}),[language]);
  return <Context.Provider value={value}>{children}<LocalizeRuntime language={language}/></Context.Provider>;
}