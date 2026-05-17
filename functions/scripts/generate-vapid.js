const webPush = require("web-push");

const keys = webPush.generateVAPIDKeys();

console.log("WEB_PUSH_VAPID_PUBLIC_KEY=");
console.log(keys.publicKey);
console.log("");
console.log("WEB_PUSH_VAPID_PRIVATE_KEY=");
console.log(keys.privateKey);
console.log("");
console.log("WEB_PUSH_VAPID_SUBJECT=");
console.log("mailto:theviciado.contactos@gmail.com");
console.log("");
console.log("Guarda a chave privada apenas nos GitHub secrets do deploy.");
