import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../../shared/utils/token';
import { getDb } from '../../config/database';
import { getRedisSubscriber, connectRedisSubscriber } from '../../config/redis';
import { serializeSupplierRanking, serializeBuyerRanking } from '../ranking/ranking.serializer';
import { logger } from '../../config/logger';
import { UserRole } from '../../shared/types/enums';

let io: SocketServer | null = null;

export function getIO(): SocketServer | null {
  return io;
}

async function verifyRfqAccess(
  user: { userId: string; role: string },
  rfqId: string,
): Promise<boolean> {
  const db = getDb();

  if (user.role === UserRole.SUPPLIER) {
    const supplier = await db('suppliers').where({ user_id: user.userId }).first();
    if (!supplier) return false;

    const assignment = await db('rfq_suppliers')
      .where({ rfq_id: rfqId, supplier_id: supplier.id })
      .first();

    return !!assignment;
  }

  if (user.role === UserRole.BUYER) {
    const rfq = await db('rfqs')
      .where({ id: rfqId, buyer_id: user.userId })
      .first();

    return !!rfq;
  }

  return false;
}

async function verifyNegotiationAccess(
  user: { userId: string; role: string },
  negotiationId: string,
): Promise<boolean> {
  const db = getDb();

  if (user.role === UserRole.SUPPLIER) {
    const supplier = await db('suppliers').where({ user_id: user.userId }).first();
    if (!supplier) return false;

    const assignment = await db('negotiation_suppliers')
      .where({ negotiation_id: negotiationId, supplier_id: supplier.id })
      .first();

    return !!assignment;
  }

  if (user.role === UserRole.BUYER) {
    const negotiation = await db('negotiation_events')
      .where({ id: negotiationId, buyer_id: user.userId })
      .first();

    return !!negotiation;
  }

  return false;
}

export function initializeWebSocket(httpServer: HttpServer): void {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth as Record<string, unknown>).token ||
        socket.handshake.query.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info('WebSocket client connected', {
      userId: socket.data.user.userId,
      role: socket.data.user.role,
    });

    socket.on('subscribe:rfq', async (data: { rfqId: string }) => {
      const { rfqId } = data;

      if (!rfqId) {
        socket.emit('error', { message: 'rfqId is required' });
        return;
      }

      const authorized = await verifyRfqAccess(socket.data.user, rfqId);
      if (!authorized) {
        socket.emit('error', { message: 'Not authorized for this RFQ' });
        return;
      }

      const role = socket.data.user.role;
      if (role === UserRole.SUPPLIER) {
        // Per-supplier room for security — each supplier gets their own data only
        socket.join(`rfq:${rfqId}:supplier:${socket.data.user.userId}`);
        socket.join(`rfq:${rfqId}:suppliers`);
      } else if (role === UserRole.BUYER) {
        socket.join(`rfq:${rfqId}:buyer`);
      }

      logger.info('Client subscribed to RFQ', {
        userId: socket.data.user.userId,
        role,
        rfqId,
      });
    });

    socket.on('subscribe:negotiation', async (data: { negotiationId: string }) => {
      const { negotiationId } = data;

      if (!negotiationId) {
        socket.emit('error', { message: 'negotiationId is required' });
        return;
      }

      const authorized = await verifyNegotiationAccess(socket.data.user, negotiationId);
      if (!authorized) {
        socket.emit('error', { message: 'Not authorized for this negotiation' });
        return;
      }

      const role = socket.data.user.role;
      if (role === UserRole.SUPPLIER) {
        socket.join(`negotiation:${negotiationId}:supplier:${socket.data.user.userId}`);
        socket.join(`negotiation:${negotiationId}:suppliers`);
      } else if (role === UserRole.BUYER) {
        socket.join(`negotiation:${negotiationId}:buyer`);
      }

      logger.info('Client subscribed to negotiation', {
        userId: socket.data.user.userId,
        role,
        negotiationId,
      });
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', {
        userId: socket.data.user.userId,
      });
    });
  });

  // Setup Redis Pub/Sub listener
  setupRedisPubSubListener();
}

async function setupRedisPubSubListener(): Promise<void> {
  try {
    await connectRedisSubscriber();
    const subscriber = getRedisSubscriber();

    await subscriber.psubscribe('ranking:*', 'deadline:*', 'ranking:neg:*', 'deadline:neg:*');

    subscriber.on('pmessage', async (_pattern: string, channel: string, message: string) => {
      if (!io) return;

      try {
        const data = JSON.parse(message);

        if (channel.startsWith('ranking:neg:')) {
          const negotiationId = channel.split(':')[2];
          await handleNegotiationRankingUpdate(negotiationId, data);
        } else if (channel.startsWith('ranking:')) {
          const rfqId = channel.split(':')[1];
          await handleRankingUpdate(rfqId, data);
        }

        if (channel.startsWith('deadline:neg:')) {
          const negotiationId = channel.split(':')[2];
          handleNegotiationDeadlineUpdate(negotiationId, data);
        } else if (channel.startsWith('deadline:')) {
          const rfqId = channel.split(':')[1];
          handleDeadlineUpdate(rfqId, data);
        }
      } catch (err) {
        logger.error('Error handling pub/sub message', { channel, error: err });
      }
    });

    logger.info('Redis Pub/Sub listener initialized');
  } catch (err) {
    logger.error('Failed to initialize Redis Pub/Sub listener', { error: err });
  }
}

async function handleRankingUpdate(
  rfqId: string,
  data: {
    item_rankings: unknown[];
    total_rankings: unknown[];
    weighted_rankings: unknown[];
  },
): Promise<void> {
  if (!io) return;

  // Emit full data to buyer room
  io.to(`rfq:${rfqId}:buyer`).emit('ranking:updated', serializeBuyerRanking(
    data.item_rankings as never[],
    data.total_rankings as never[],
    data.weighted_rankings as never[],
  ));

  // Emit serialized data to each connected supplier
  const supplierRoom = io.in(`rfq:${rfqId}:suppliers`);
  const sockets = await supplierRoom.fetchSockets();

  for (const socket of sockets) {
    const db = getDb();
    const supplier = await db('suppliers')
      .where({ user_id: socket.data.user.userId })
      .select('id')
      .first();

    if (supplier) {
      const serialized = serializeSupplierRanking(
        supplier.id,
        data.total_rankings as never[],
        data.item_rankings as never[],
      );
      socket.emit('ranking:updated', serialized);
    }
  }
}

function handleDeadlineUpdate(
  rfqId: string,
  data: unknown,
): void {
  if (!io) return;

  // Broadcast deadline extension to all connected clients for this RFQ
  io.to(`rfq:${rfqId}:buyer`).emit('deadline:extended', data);
  io.to(`rfq:${rfqId}:suppliers`).emit('deadline:extended', data);
}

async function handleNegotiationRankingUpdate(
  negotiationId: string,
  data: {
    item_rankings: unknown[];
    total_rankings: unknown[];
    weighted_rankings: unknown[];
  },
): Promise<void> {
  if (!io) return;

  // Emit full data to buyer room
  io.to(`negotiation:${negotiationId}:buyer`).emit('ranking:updated', serializeBuyerRanking(
    data.item_rankings as never[],
    data.total_rankings as never[],
    data.weighted_rankings as never[],
  ));

  // Emit serialized data to each connected supplier
  const supplierRoom = io.in(`negotiation:${negotiationId}:suppliers`);
  const sockets = await supplierRoom.fetchSockets();

  for (const socket of sockets) {
    const db = getDb();
    const supplier = await db('suppliers')
      .where({ user_id: socket.data.user.userId })
      .select('id')
      .first();

    if (supplier) {
      const serialized = serializeSupplierRanking(
        supplier.id,
        data.total_rankings as never[],
        data.item_rankings as never[],
      );
      socket.emit('ranking:updated', serialized);
    }
  }
}

function handleNegotiationDeadlineUpdate(
  negotiationId: string,
  data: unknown,
): void {
  if (!io) return;

  io.to(`negotiation:${negotiationId}:buyer`).emit('deadline:extended', data);
  io.to(`negotiation:${negotiationId}:suppliers`).emit('deadline:extended', data);
}
