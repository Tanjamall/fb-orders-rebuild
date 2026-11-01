import {test} from 'node:test';import assert from 'node:assert/strict';import {whatsappUrl} from './phone';
test('WhatsApp links normalize Moroccan mobile and international formats',()=>{
 assert.equal(whatsappUrl('06 00 00 00 00'),'https://wa.me/212600000000');
 assert.equal(whatsappUrl('0700000000'),'https://wa.me/212700000000');
 assert.equal(whatsappUrl('+212 600 000001'),'https://wa.me/212600000001');
 assert.equal(whatsappUrl('00212600000001'),'https://wa.me/212600000001');
 assert.equal(whatsappUrl('+33 6 12 34 56 78'),'https://wa.me/33612345678');
 assert.equal(whatsappUrl(''),null);
});
