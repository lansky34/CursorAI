const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '../certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

try {
    // Generate self-signed certificate for development
    execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${path.join(certsDir, 'localhost-key.pem')} \
        -out ${path.join(certsDir, 'localhost-cert.pem')} -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Development/CN=localhost"`);

    console.log('Development certificates generated successfully');
} catch (error) {
    console.error('Error generating certificates:', error);
    process.exit(1);
} 