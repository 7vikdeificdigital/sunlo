// Tests hamesha alag test database par chalte hain
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://astroway:astroway_dev@localhost:5432/sunlo_test';
process.env.JWT_ACCESS_SECRET = 'test_only_jwt_secret_0123456789abcdefghijklmnop';
process.env.OTP_PEPPER = 'test_only_otp_pepper_0123456789abcdefghijklmnop';
process.env.SMS_PROVIDER = 'console';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.AGORA_APP_ID = 'a'.repeat(32);
process.env.AGORA_APP_CERTIFICATE = 'b'.repeat(32);
process.env.UPLOAD_DIR = require('node:path').join(require('node:os').tmpdir(), 'sunlo-test-uploads');
process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(JSON.stringify({ project_id: 'sunlo-test' })).toString('base64');
