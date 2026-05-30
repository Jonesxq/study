export type FeishuWikiPage = {
  sourceId: string;
  documentId: string;
  title: string;
  parentId?: string;
  updatedAt?: string;
};

export type FeishuBlock =
  | {
      type: 'text';
      text?: string;
    }
  | {
      type: 'heading';
      level: number;
      text?: string;
    }
  | {
      type: 'bullet';
      text?: string;
    }
  | {
      type: 'ordered';
      text?: string;
      number?: number;
    }
  | {
      type: 'code';
      text?: string;
      language?: string;
    }
  | {
      type: 'divider';
    }
  | {
      type: 'image';
      token?: string;
      path?: string;
      alt?: string;
    };

export interface FeishuClient {
  listWikiPages(): Promise<FeishuWikiPage[]>;
  getDocumentBlocks(documentId: string): Promise<FeishuBlock[]>;
  downloadAsset(token: string, targetPath: string): Promise<string | undefined>;
}

export type FeishuSyncStatus = 'success' | 'failed' | 'partial';

export type FeishuSyncStats = {
  created: number;
  updated: number;
  removed: number;
  failed: number;
  scanned: number;
};
