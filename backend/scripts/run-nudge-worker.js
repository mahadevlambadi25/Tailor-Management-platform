#!/usr/bin/env node
/**
 * Standalone EventBridge Nudge Worker Entrypoint
 * - Intended for one-off ECS Fargate task execution triggered by Amazon EventBridge
 * - Forces cycle execution even when ENABLE_BACKGROUND_SCHEDULER=false
 * - Propagates database errors and exits with non-zero code on failure
 * - Ensures Prisma disconnects in all execution paths (success or failure)
 * - Guarantees cleanup completes BEFORE process exit
 */

const path = require('path');
const fs = require('fs');

async function main() {
  let NudgeScheduler;

  const distPath = path.resolve(__dirname, '../dist/modules/conversion/nudgeScheduler.js');
  if (fs.existsSync(distPath)) {
    ({ NudgeScheduler } = require('../dist/modules/conversion/nudgeScheduler'));
  } else {
    // Development or test fallback
    require('ts-node/register');
    ({ NudgeScheduler } = require('../src/modules/conversion/nudgeScheduler'));
  }

  const exitCode = await NudgeScheduler.runStandalone();
  process.exit(exitCode);
}

if (require.main === module) {
  main().catch((fatalErr) => {
    console.error('[run-nudge-worker] Unhandled fatal error:', fatalErr);
    process.exit(1);
  });
}

module.exports = { main };
