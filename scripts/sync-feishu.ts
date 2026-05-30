import { getDatabase } from '@/lib/db/client';
import { HttpFeishuClient } from '@/lib/feishu/client';
import { syncFeishuPages } from '@/lib/feishu/sync';

async function main() {
  const appId = requiredEnv('FEISHU_APP_ID');
  const appSecret = requiredEnv('FEISHU_APP_SECRET');
  const source = requiredEnv('FEISHU_SYNC_SOURCE');
  const uploadDir = process.env.UPLOAD_DIR ?? './public/uploads/feishu';
  const db = getDatabase();
  const client = new HttpFeishuClient({
    appId,
    appSecret,
    source,
  });
  const result = await syncFeishuPages({ db, client, uploadDir });

  console.log(JSON.stringify(result, null, 2));

  if (result.status === 'failed') {
    process.exitCode = 1;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
