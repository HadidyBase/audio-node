import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export class WebhookVerifier {
  private readonly secret: string;

  constructor(secret: string) {
    if (!secret) throw new Error('WebhookVerifier: secret must not be empty');
    this.secret = secret;
  }

  verify(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) return false;

    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const expected = createHmac('sha256', this.secret)
      .update(rawBody)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  expressMiddleware() {
    return (
      req: IncomingMessage & { body?: Buffer | string; rawBody?: Buffer },
      res: ServerResponse,
      next: () => void,
    ) => {
      const sig = (req.headers['x-webhook-signature'] as string | undefined) ?? '';
      const body = (req as { rawBody?: Buffer; body?: Buffer | string }).rawBody ?? (req as { body?: Buffer | string }).body ?? '';
      if (!this.verify(body, sig)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid webhook signature' }));
        return;
      }
      next();
    };
  }

  fastifyPlugin() {
    return async (fastify: {
      addHook: (
        event: string,
        handler: (
          request: { headers: Record<string, string | string[] | undefined>; rawBody?: Buffer; body?: unknown },
          reply: { code: (n: number) => { send: (v: unknown) => void } },
          done?: () => void,
        ) => void | Promise<void>,
      ) => void;
    }) => {
      fastify.addHook('preHandler', async (request, reply) => {
        const sig = (request.headers['x-webhook-signature'] as string | undefined) ?? '';
        const rawBody = request.rawBody;
        if (!rawBody) {
          // rawBody is absent — Fastify must be configured to preserve it:
          //   fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
          //     (req as any).rawBody = body;
          //     done(null, JSON.parse(body.toString()));
          //   });
          return reply.code(400).send({
            error: 'rawBody not available — configure Fastify to preserve the raw request body for HMAC verification',
          });
        }
        if (!this.verify(rawBody, sig)) {
          return reply.code(401).send({ error: 'Invalid webhook signature' });
        }
      });
    };
  }
}
