import { eventBus, MAEFEvent } from '../event_bus.ts';
import { processMemoryWriteQueue } from '../../../memory_write_worker.ts';

export const registerMemorySubscribers = () => {
  eventBus.subscribe('Memory.WriteRequested', (event: MAEFEvent) => {
    const { rctx, userId, message, canWriteMemory, mode, workspaceId } = event.payload;
    
    if (rctx?.env?.enableAsyncMemoryWrite && canWriteMemory) {
      const supUrl = rctx.env.supabaseUrl;
      const supKey = rctx.env.supabaseServiceKey;
      if (rctx.tasks) {
        // rctx ikut diteruskan supaya memori yang ditulis punya embedding —
        // generateEmbedding butuh RuntimeContext untuk mencapai adapter (Item 46).
        rctx.tasks.fire('MemoryWriteQueue', processMemoryWriteQueue(userId, message, supUrl, supKey, mode, workspaceId, rctx));
      }
    }
  });
};
