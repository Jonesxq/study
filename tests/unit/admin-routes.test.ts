import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminMock = vi.fn();
const getDatabaseMock = vi.fn();
const getSettingMock = vi.fn();
const setSiteSettingsMock = vi.fn();
const syncFeishuPagesMock = vi.fn();
const httpFeishuClientMock = vi.fn(function HttpFeishuClient(options: unknown) {
  return { options };
});

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/db/client', () => ({
  getDatabase: getDatabaseMock,
}));

vi.mock('@/lib/db/settings', () => ({
  getSetting: getSettingMock,
  setSiteSettings: setSiteSettingsMock,
}));

vi.mock('@/lib/feishu/client', () => ({
  HttpFeishuClient: httpFeishuClientMock,
}));

vi.mock('@/lib/feishu/sync', () => ({
  syncFeishuPages: syncFeishuPagesMock,
}));

const originalEnv = {
  FEISHU_APP_ID: process.env.FEISHU_APP_ID,
  FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET,
  FEISHU_SYNC_SOURCE: process.env.FEISHU_SYNC_SOURCE,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getDatabaseMock.mockReturnValue({ id: 'test-db' });
  getSettingMock.mockReturnValue('');
  syncFeishuPagesMock.mockResolvedValue({
    status: 'success',
    stats: { created: 0, updated: 0, removed: 0, failed: 0, scanned: 0 },
    noteIds: [],
    runId: 'sync-run-id',
  });
  process.env.FEISHU_APP_ID = originalEnv.FEISHU_APP_ID;
  process.env.FEISHU_APP_SECRET = originalEnv.FEISHU_APP_SECRET;
  process.env.FEISHU_SYNC_SOURCE = originalEnv.FEISHU_SYNC_SOURCE;
  process.env.UPLOAD_DIR = originalEnv.UPLOAD_DIR;
});

afterEach(() => {
  process.env.FEISHU_APP_ID = originalEnv.FEISHU_APP_ID;
  process.env.FEISHU_APP_SECRET = originalEnv.FEISHU_APP_SECRET;
  process.env.FEISHU_SYNC_SOURCE = originalEnv.FEISHU_SYNC_SOURCE;
  process.env.UPLOAD_DIR = originalEnv.UPLOAD_DIR;
});

describe('/api/admin/settings route', () => {
  it('requires admin before parsing or saving settings', async () => {
    const order: string[] = [];
    requireAdminMock.mockRejectedValueOnce(new Error('not allowed'));
    const request = {
      url: 'https://example.test/api/admin/settings',
      formData: vi.fn(async () => {
        order.push('parse');
        return new FormData();
      }),
    } as unknown as Request;
    const { POST } = await import('@/app/api/admin/settings/route');

    await expect(POST(request)).rejects.toThrow('not allowed');

    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(request.formData).not.toHaveBeenCalled();
    expect(setSiteSettingsMock).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });

  it('returns a Chinese 400 response when site name is empty', async () => {
    requireAdminMock.mockResolvedValueOnce(undefined);
    const form = new FormData();
    form.set('site_name', '   ');
    form.set('site_description', '站点简介');
    form.set('feishu_sync_source', 'space_a');
    const { POST } = await import('@/app/api/admin/settings/route');

    const response = await POST(new Request('https://example.test/api/admin/settings', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('站点名称不能为空。');
    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(setSiteSettingsMock).not.toHaveBeenCalled();
  });

  it('saves valid settings and redirects with an explicit 303', async () => {
    const order: string[] = [];
    requireAdminMock.mockImplementationOnce(async () => {
      order.push('auth');
    });
    setSiteSettingsMock.mockImplementationOnce(() => {
      order.push('save');
    });
    const form = new FormData();
    form.set('site_name', '新的站点名');
    form.set('site_description', '新的站点简介');
    form.set('feishu_sync_source', 'space_a:node_b');
    const { POST } = await import('@/app/api/admin/settings/route');

    const response = await POST(new Request('https://example.test/api/admin/settings', { method: 'POST', body: form }));

    expect(order).toEqual(['auth', 'save']);
    expect(setSiteSettingsMock).toHaveBeenCalledWith(
      { id: 'test-db' },
      {
        siteName: '新的站点名',
        siteDescription: '新的站点简介',
        feishuSyncSource: 'space_a:node_b',
      },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.test/admin/settings?saved=1');
  });
});

describe('/api/admin/sync route', () => {
  it('requires admin before reading sync configuration', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('not allowed'));
    const { POST } = await import('@/app/api/admin/sync/route');

    await expect(POST(new Request('https://example.test/api/admin/sync', { method: 'POST' }))).rejects.toThrow(
      'not allowed',
    );

    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(syncFeishuPagesMock).not.toHaveBeenCalled();
  });

  it.each([
    ['FEISHU_APP_ID', { FEISHU_APP_ID: '', FEISHU_APP_SECRET: 'secret', FEISHU_SYNC_SOURCE: 'env_space' }],
    ['FEISHU_APP_SECRET', { FEISHU_APP_ID: 'app', FEISHU_APP_SECRET: '', FEISHU_SYNC_SOURCE: 'env_space' }],
    ['source', { FEISHU_APP_ID: 'app', FEISHU_APP_SECRET: 'secret', FEISHU_SYNC_SOURCE: '' }],
  ])('redirects when %s is missing and does not start sync', async (_name, env) => {
    requireAdminMock.mockResolvedValueOnce(undefined);
    process.env.FEISHU_APP_ID = env.FEISHU_APP_ID;
    process.env.FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
    process.env.FEISHU_SYNC_SOURCE = env.FEISHU_SYNC_SOURCE;
    getSettingMock.mockReturnValueOnce('');
    const { POST } = await import('@/app/api/admin/sync/route');

    const response = await POST(new Request('https://example.test/api/admin/sync', { method: 'POST' }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.test/admin/sync?error=missing_config');
    expect(syncFeishuPagesMock).not.toHaveBeenCalled();
    expect(httpFeishuClientMock).not.toHaveBeenCalled();
  });

  it('prefers the DB Feishu sync source over the environment source', async () => {
    requireAdminMock.mockResolvedValueOnce(undefined);
    process.env.FEISHU_APP_ID = 'app-id';
    process.env.FEISHU_APP_SECRET = 'app-secret';
    process.env.FEISHU_SYNC_SOURCE = 'env_space';
    process.env.UPLOAD_DIR = './tmp/uploads';
    getSettingMock.mockReturnValueOnce('db_space:db_node');
    syncFeishuPagesMock.mockResolvedValueOnce({
      status: 'partial',
      stats: { created: 1, updated: 2, removed: 0, failed: 1, scanned: 4 },
      noteIds: ['note-id'],
      runId: 'run-id',
    });
    const { POST } = await import('@/app/api/admin/sync/route');

    const response = await POST(new Request('https://example.test/api/admin/sync', { method: 'POST' }));

    expect(httpFeishuClientMock).toHaveBeenCalledWith({
      appId: 'app-id',
      appSecret: 'app-secret',
      source: 'db_space:db_node',
    });
    expect(syncFeishuPagesMock).toHaveBeenCalledWith({
      db: { id: 'test-db' },
      client: { options: { appId: 'app-id', appSecret: 'app-secret', source: 'db_space:db_node' } },
      uploadDir: './tmp/uploads',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.test/admin/sync?status=partial');
  });

  it('redirects to the completed sync status', async () => {
    requireAdminMock.mockResolvedValueOnce(undefined);
    process.env.FEISHU_APP_ID = 'app-id';
    process.env.FEISHU_APP_SECRET = 'app-secret';
    process.env.FEISHU_SYNC_SOURCE = 'env_space';
    getSettingMock.mockReturnValueOnce('');
    syncFeishuPagesMock.mockResolvedValueOnce({
      status: 'success',
      stats: { created: 1, updated: 0, removed: 0, failed: 0, scanned: 1 },
      noteIds: ['note-id'],
      runId: 'run-id',
    });
    const { POST } = await import('@/app/api/admin/sync/route');

    const response = await POST(new Request('https://example.test/api/admin/sync', { method: 'POST' }));

    expect(syncFeishuPagesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.test/admin/sync?status=success');
  });
});

describe('/api/health route', () => {
  it('checks the database connection and returns ok JSON', async () => {
    const getMock = vi.fn();
    const prepareMock = vi.fn(() => ({ get: getMock }));
    getDatabaseMock.mockReturnValueOnce({ prepare: prepareMock });
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();

    expect(prepareMock).toHaveBeenCalledWith('select 1');
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
