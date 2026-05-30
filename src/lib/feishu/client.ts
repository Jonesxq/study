import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FeishuBlock, FeishuClient, FeishuWikiPage } from './types';

const FEISHU_BASE_URL = 'https://open.feishu.cn';
const TOKEN_SAFETY_WINDOW_MS = 60_000;
const DOCX_RATE_LIMIT_CODE = 99_991_400;

type HttpFeishuClientOptions = {
  appId: string;
  appSecret: string;
  source: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
};

type TenantTokenResponse = {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
};

type FeishuApiResponse<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

type WikiNode = {
  node_token?: string;
  obj_token?: string;
  obj_type?: string;
  parent_node_token?: string;
  title?: string;
  obj_edit_time?: string | number;
  has_child?: boolean;
};

type WikiNodeListData = {
  items?: WikiNode[];
  has_more?: boolean;
  page_token?: string;
};

type DocxBlocksData = {
  items?: unknown[];
  has_more?: boolean;
  page_token?: string;
};

export class HttpFeishuClient implements FeishuClient {
  private token?: {
    value: string;
    expiresAt: number;
  };

  private readonly appId: string;
  private readonly appSecret: string;
  private readonly source: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(options: HttpFeishuClientOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.source = options.source;
    this.baseUrl = options.baseUrl ?? FEISHU_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 4;
  }

  async listWikiPages(): Promise<FeishuWikiPage[]> {
    const { spaceId, parentNodeToken } = parseSource(this.source);
    const pages: FeishuWikiPage[] = [];
    const visitedParents = new Set<string>();

    await this.collectWikiPages(spaceId, parentNodeToken, pages, visitedParents);

    return pages;
  }

  async getDocumentBlocks(documentId: string): Promise<FeishuBlock[]> {
    const blocks: FeishuBlock[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ page_size: '500' });
      if (pageToken) params.set('page_token', pageToken);

      const data = await this.request<DocxBlocksData>(
        `/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}/blocks?${params.toString()}`,
        { retryRateLimit: true },
      );

      for (const item of data.items ?? []) {
        const block = mapRawBlock(item);
        if (block) blocks.push(block);
      }

      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);

    return blocks;
  }

  async downloadAsset(token: string, targetPath: string): Promise<string | undefined> {
    const asset = await this.request<ArrayBuffer>(
      `/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`,
      { raw: true },
    );

    await mkdir(dirname(targetPath), { recursive: true });
    const body = Buffer.from(asset);
    await pipeline(Readable.from(body), createWriteStream(targetPath));

    return targetPath;
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      retryRateLimit?: boolean;
      raw?: boolean;
    } = {},
  ): Promise<T> {
    const token = await this.getTenantAccessToken();
    let attempt = 0;

    while (true) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (options.raw) {
        if (!response.ok) {
          throw new Error(`Feishu HTTP ${response.status}: ${await response.text()}`);
        }

        return (await response.arrayBuffer()) as T;
      }

      const payload = (await response.json().catch(() => undefined)) as FeishuApiResponse<T> | undefined;
      const code = payload?.code ?? (response.ok ? 0 : response.status);

      if (response.ok && code === 0) {
        return (payload?.data ?? payload) as T;
      }

      if (options.retryRateLimit && isRateLimitError(response.status, code) && attempt < this.maxRetries) {
        await sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }

      throw new Error(`Feishu API ${code}: ${payload?.msg ?? response.statusText}`);
    }
  }

  private async collectWikiPages(
    spaceId: string,
    parentNodeToken: string | undefined,
    pages: FeishuWikiPage[],
    visitedParents: Set<string>,
  ): Promise<void> {
    const visitKey = parentNodeToken ?? '__root__';
    if (visitedParents.has(visitKey)) return;
    visitedParents.add(visitKey);

    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ page_size: '50' });
      if (pageToken) params.set('page_token', pageToken);
      if (parentNodeToken) params.set('parent_node_token', parentNodeToken);

      const data = await this.request<WikiNodeListData>(
        `/open-apis/wiki/v2/spaces/${encodeURIComponent(spaceId)}/nodes?${params.toString()}`,
      );

      for (const node of data.items ?? []) {
        if (node.obj_token && isDocumentNode(node.obj_type)) {
          pages.push({
            sourceId: node.obj_token,
            documentId: node.obj_token,
            title: node.title?.trim() || 'Untitled',
            parentId: node.parent_node_token || undefined,
            updatedAt: toIsoDate(node.obj_edit_time),
          });
        }

        if (node.has_child && node.node_token) {
          await this.collectWikiPages(spaceId, node.node_token, pages, visitedParents);
        }
      }

      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);
  }

  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.token && this.token.expiresAt - TOKEN_SAFETY_WINDOW_MS > now) {
      return this.token.value;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });
    const payload = (await response.json().catch(() => undefined)) as TenantTokenResponse | undefined;

    if (!response.ok || payload?.code !== 0 || !payload.tenant_access_token) {
      throw new Error(`Feishu token ${payload?.code ?? response.status}: ${payload?.msg ?? response.statusText}`);
    }

    this.token = {
      value: payload.tenant_access_token,
      expiresAt: now + Math.max((payload.expire ?? 0) * 1000, 0),
    };

    return this.token.value;
  }
}

function parseSource(source: string): { spaceId: string; parentNodeToken?: string } {
  const [spaceId, parentNodeToken] = source.split(':');

  if (!spaceId?.trim()) {
    throw new Error('FEISHU_SYNC_SOURCE must be "space_id" or "space_id:parent_node_token"');
  }

  return {
    spaceId: spaceId.trim(),
    parentNodeToken: parentNodeToken?.trim() || undefined,
  };
}

function isDocumentNode(objType?: string): boolean {
  return objType === 'docx' || objType === 'doc';
}

function toIsoDate(value?: string | number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;

  const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  return new Date(millis).toISOString();
}

function isRateLimitError(status: number, code: number): boolean {
  return status === 400 && code === DOCX_RATE_LIMIT_CODE;
}

function backoffMs(attempt: number): number {
  return 250 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapRawBlock(raw: unknown): FeishuBlock | undefined {
  if (!isRecord(raw)) return undefined;

  const type = Number(raw.block_type);

  if (type === 1) return undefined;
  if (type === 2) return { type: 'text', text: extractElementsText(raw.text) };
  if (type >= 3 && type <= 11) {
    const headingKey = `heading${type - 2}`;
    return {
      type: 'heading',
      level: type - 2,
      text: extractElementsText(raw[headingKey]),
    };
  }
  if (type === 12) return { type: 'bullet', text: extractElementsText(raw.bullet) };
  if (type === 13) return { type: 'ordered', text: extractElementsText(raw.ordered) };
  if (type === 14) {
    return {
      type: 'code',
      text: extractElementsText(raw.code),
      language: extractCodeLanguage(raw.code),
    };
  }
  if (type === 22) return { type: 'divider' };
  if (type === 27) {
    const image = isRecord(raw.image) ? raw.image : raw;
    const token = stringValue(image.token) ?? stringValue(image.file_token);
    return {
      type: 'image',
      token,
      alt: stringValue(image.alt) ?? '',
    };
  }

  return undefined;
}

function extractElementsText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  if (typeof value.content === 'string') return value.content;

  const elements = Array.isArray(value.elements) ? value.elements : [];

  return elements
    .map((element) => {
      if (!isRecord(element)) return '';
      if (typeof element.text === 'string') return element.text;
      if (isRecord(element.text_run) && typeof element.text_run.content === 'string') return element.text_run.content;
      if (isRecord(element.mention_user) && typeof element.mention_user.name === 'string') return element.mention_user.name;
      if (isRecord(element.mention_doc) && typeof element.mention_doc.title === 'string') return element.mention_doc.title;
      if (isRecord(element.equation) && typeof element.equation.content === 'string') return element.equation.content;
      return '';
    })
    .join('');
}

function extractCodeLanguage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return stringValue(value.language) ?? stringValue(value.syntax);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
