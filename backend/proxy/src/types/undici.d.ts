declare module 'undici' {
  export class Pool {
    constructor(url: string | URL, options?: {
      connections?: number;
      pipelining?: number;
      keepAliveTimeout?: number;
      keepAliveMaxTimeout?: number;
    });
    request(options: {
      path: string;
      method: string;
      headers?: Record<string, string | string[] | undefined>;
      body?: any;
    }): Promise<{
      statusCode: number;
      headers: Record<string, string | string[] | undefined>;
      body: {
        pipe: (destination: any) => any;
        text: () => Promise<string>;
        json: () => Promise<any>;
      };
    }>;
    close(): Promise<void>;
    destroy(): Promise<void>;
  }
}
