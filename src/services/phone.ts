export function whatsappUrl(phone:string):string|null {
 let digits=phone.replace(/[^0-9]/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(/^0[67][0-9]{8}$/.test(digits))digits='212'+digits.slice(1);
 return digits?'https://wa.me/'+digits:null;
}
