import React from 'react';
import {whatsappUrl} from '../services/phone';
export function WhatsAppLink({phone}:{phone:string}){
 const href=whatsappUrl(phone);if(!href)return null;
 return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={'WhatsApp '+phone} title="Open WhatsApp" onClick={e=>e.stopPropagation()} className="inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a9.3 9.3 0 0 1-9.5 9.5 10.6 10.6 0 0 1-4.2-.9L3 21l1-4.3a9.6 9.6 0 0 1-1-4.2A9.3 9.3 0 0 1 12.5 3 9.3 9.3 0 0 1 21 11.5Z"/><path d="m8.2 7.7 1.3 2.6-1 1.1a9 9 0 0 0 4.2 4.1l1.1-1.2 2.6 1.3c-.3 1.6-1.6 2.2-3 1.7-3.5-1.1-6.3-4-7.1-6.9-.4-1.4.4-2.5 1.9-2.7Z"/></svg></a>;
}
