import cluster from 'cluster';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEntry = path.resolve(__dirname, '../server/src/index.js');

const numWorkers = parseInt(process.env.CLUSTER_WORKERS || '', 10) || Math.min(os.cpus().length, 4);

if (cluster.isPrimary || cluster.isMaster) {
  console.log('\n======================================================================');
  console.log(' ⚖️ J & D BEACH HOUSE HIGH-AVAILABILITY CLUSTER LOAD BALANCER ⚖️');
  console.log('======================================================================');
  console.log(`[Primary LB] Master process ${process.pid} is orchestrating ${numWorkers} worker nodes.`);
  console.log(`[Primary LB] Scheduling Policy: Round-Robin (SCHED_RR)`);
  console.log(`[Primary LB] Target Server: ${serverEntry}\n`);

  cluster.schedulingPolicy = cluster.SCHED_RR;

  // Fork worker instances
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork({ WORKER_INSTANCE_ID: i + 1 });
    console.log(`[Primary LB] Worker Node #${i + 1} spawned (PID: ${worker.process.pid})`);
  }

  cluster.on('online', (worker) => {
    console.log(`✦ [Worker Online] Worker ${worker.process.pid} is ready and accepting requests.`);
  });

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️ [Worker Terminated] Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}).`);
    console.log('[Primary LB] Spawning replacement worker node to maintain cluster capacity...');
    cluster.fork();
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n[Primary LB] SIGTERM received. Gracefully draining worker connections...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill('SIGTERM');
    }
  });

} else {
  // Worker process executes the Express server
  await import(serverEntry);
}
