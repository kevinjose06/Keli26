const mkcert = require('mkcert');
const fs = require('fs');

async function main() {
  const ca = await mkcert.createCA({
    organization: 'Test CA',
    countryCode: 'US',
    state: 'CA',
    locality: 'SF',
    validity: 365
  });
  const cert = await mkcert.createCert({
    ca: { key: ca.key, cert: ca.cert },
    domains: ['127.0.0.1', 'localhost'],
    validity: 365
  });
  fs.writeFileSync('server.key', cert.key);
  fs.writeFileSync('server.cert', cert.cert);
  console.log('Certificates created successfully');
}
main();
