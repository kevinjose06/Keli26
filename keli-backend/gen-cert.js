const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, "server.key");
const certPath = path.join(__dirname, "server.cert");

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log("✓ server.key and server.cert already exist.");
  process.exit(0);
}

console.log("Generating self-signed SSL certificates for HTTPS...");
try {
  // Try openssl
  execSync(`openssl req -nodes -new -x509 -keyout "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=keli-scan"`, { stdio: "inherit" });
  console.log("✓ Generated server.key and server.cert using OpenSSL");
} catch (e) {
  console.log("OpenSSL CLI not found. Attempting PowerShell self-signed certificate generation...");
  try {
    const psCmd = `powershell -Command "$cert = New-SelfSignedCertificate -DnsName 'keli-scan' -CertStoreLocation 'cert:\\CurrentUser\\My'; $pwd = ConvertTo-SecureString -String 'keli' -Force -AsPlainText; Export-PfxCertificate -Cert $cert -FilePath '${path.join(__dirname, "cert.pfx")}' -Password $pwd"`;
    execSync(psCmd, { stdio: "inherit" });
    console.log("Please install OpenSSL or Git for Windows to convert cert.pfx to server.key and server.cert.");
  } catch (err) {
    console.error("Could not auto-generate certs. Please install Git for Windows (includes openssl) or run:");
    console.error("openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365");
  }
}
