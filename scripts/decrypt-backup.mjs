// Opens an encrypted Spark backup with the private key.
// usage: node scripts/decrypt-backup.mjs <spark-backup-private.pem> <backup.enc.json> [out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { createDecipheriv, privateDecrypt, constants } from 'node:crypto';

const [keyPath, inPath, outPath = inPath.replace(/\.enc\.json$/, '') + '.json'] = process.argv.slice(2);
if (!keyPath || !inPath) { console.error('usage: node decrypt-backup.mjs <private.pem> <backup.enc.json> [out.json]'); process.exit(1); }
const box = JSON.parse(readFileSync(inPath, 'utf8'));
const aesKey = privateDecrypt({ key: readFileSync(keyPath), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(box.key, 'base64'));
const data = Buffer.from(box.data, 'base64');
const tag = data.subarray(data.length - 16), body = data.subarray(0, data.length - 16);
const d = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(box.iv, 'base64'));
d.setAuthTag(tag);
const plain = Buffer.concat([d.update(body), d.final()]);
writeFileSync(outPath, JSON.stringify(JSON.parse(plain), null, 1));
const t = JSON.parse(plain);
console.log('backup from', t.taken_at, '→', outPath);
for (const [k, v] of Object.entries(t.tables)) if (Array.isArray(v)) console.log(' ', k.padEnd(22), v.length, 'rows');
