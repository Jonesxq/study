import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('deployment assets', () => {
  it('keeps unsafe local files out of the Docker build context', () => {
    const dockerignore = readRepoFile('.dockerignore');

    expect(dockerignore).toContain('node_modules/');
    expect(dockerignore).toContain('.env');
    expect(dockerignore).toContain('.env.*');
    expect(dockerignore).toContain('!.env.example');
    expect(dockerignore).toContain('data/');
    expect(dockerignore).toContain('uploads/');
    expect(dockerignore).toContain('backups/');
    expect(dockerignore).toContain('.next/');
    expect(dockerignore).toContain('.git/');
    expect(dockerignore).toContain('test-results/');
    expect(dockerignore).toContain('playwright-report/');
  });

  it('stores Feishu uploads in the public upload directory', () => {
    expect(readRepoFile('.env.example')).toContain('UPLOAD_DIR=/app/public/uploads/feishu');
    expect(readRepoFile('docker-compose.yml')).toContain('./uploads:/app/public/uploads/feishu');
    expect(readRepoFile('Dockerfile')).toContain('/app/public/uploads/feishu');
  });

  it('documents production secrets and Feishu sync source format', () => {
    const docs = readRepoFile('docs/deployment.md');

    expect(docs).toContain('必须修改 `ADMIN_PASSWORD`');
    expect(docs).toContain('`space_id`');
    expect(docs).toContain('`space_id:parent_node_token`');
    expect(docs).toContain('上传图片会持久化在宿主 `./uploads`');
  });
});
