/**
 * engine.js — Comprehensive multi-pattern synthetic transaction generator.
 * 
 * Partitions distinct account cohorts for each of the 19 typologies to prevent
 * cross-typology edge collision and ensure all 19 patterns are independently
 * and accurately detected.
 */

import { PATTERNS_REGISTRY } from './patterns';

export function generateSyntheticTransactions({
  numAccounts = 85,
  numTransactions = 1200,
  minAmount = 15,
  maxAmount = 50000,
  startDate = '2026-01-01',
  endDate = '2026-07-22',
  selectedPatternIds = [],
  fraudIntensity = 4,
  fraudPercentage = 20,
  txnPrefix = 'TXN',
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const deltaMs = Math.max(1000, end.getTime() - start.getTime());

  // Ensure sufficient account pool for all 19 distinct cohorts
  const effectiveNumAccounts = Math.max(numAccounts, 95);
  const accounts = Array.from({ length: effectiveNumAccounts }, (_, i) => `ACC_${String(i + 1).padStart(4, '0')}`);
  const transactions = [];
  let index = 1;

  const getRandomTime = (isNight = false) => {
    const offset = Math.floor(Math.random() * deltaMs);
    const d = new Date(start.getTime() + offset);
    if (isNight) {
      d.setHours(Math.floor(Math.random() * 4) + 1, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
    }
    return d;
  };

  const formatTimestamp = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // If no specific patterns specified, default to ALL 19 patterns
  const activePatternSet = new Set(
    selectedPatternIds && selectedPatternIds.length > 0
      ? selectedPatternIds
      : PATTERNS_REGISTRY.map((p) => p.id)
  );

  // Helper to append a transaction
  const addTxn = (sender, receiver, amount, timestamp, isFraud = 1, scenario = null, channel = 'ONLINE') => {
    transactions.push({
      transaction_id: `${txnPrefix}_${String(index++).padStart(7, '0')}`,
      sender_id: sender,
      receiver_id: receiver,
      amount: Number(amount.toFixed(2)),
      timestamp: typeof timestamp === 'string' ? timestamp : formatTimestamp(timestamp),
      is_fraud: isFraud,
      scenario_id: scenario,
      channel: channel,
    });
  };

  // ────────────────────────────────────────────────────────────
  // 1. DEDICATED TOPOLOGICAL INJECTIONS (All 19 Typologies)
  // ────────────────────────────────────────────────────────────
  // For large datasets (e.g. 10k+ transactions), scale pattern injections proportionally
  const targetFraudCount = Math.max(80, Math.floor(numTransactions * (fraudPercentage / 100)));
  const ringRounds = Math.max(1, Math.min(50, Math.floor(targetFraudCount / 85)));

  for (let round = 0; round < ringRounds; round++) {
    const accOffset = round * 85;
    const getAcc = (idx) => accounts[(accOffset + idx) % accounts.length];

    // Pattern 1: Circular Cycle Rings
    if (activePatternSet.has('circular_transaction')) {
      const [a, b, c, d] = [getAcc(0), getAcc(1), getAcc(2), getAcc(3)];
      const t0 = getRandomTime();
      const amt = 18500.0 + round * 1200;
      addTxn(a, b, amt, t0, 1, 'circular_transaction', 'WIRE');
      addTxn(b, c, amt * 0.98, new Date(t0.getTime() + 180000), 1, 'circular_transaction', 'WIRE');
      addTxn(c, d, amt * 0.96, new Date(t0.getTime() + 360000), 1, 'circular_transaction', 'WIRE');
      addTxn(d, a, amt * 0.94, new Date(t0.getTime() + 540000), 1, 'circular_transaction', 'WIRE');
    }

    // Pattern 2: Fan-In Aggregation Hub
    if (activePatternSet.has('fan_in')) {
      const hub = getAcc(11);
      const senders = [getAcc(4), getAcc(5), getAcc(6), getAcc(7), getAcc(8), getAcc(9), getAcc(10)];
      const t0 = getRandomTime();
      senders.forEach((s, idx) => {
        const amt = 4800 + Math.random() * 2000;
        addTxn(s, hub, amt, new Date(t0.getTime() + idx * 45000), 1, 'fan_in', 'ACH');
      });
    }

    // Pattern 3: Fan-Out Dispersion
    if (activePatternSet.has('fan_out')) {
      const master = getAcc(12);
      const receivers = [getAcc(13), getAcc(14), getAcc(15), getAcc(16), getAcc(17), getAcc(18), getAcc(19)];
      const t0 = getRandomTime();
      receivers.forEach((r, idx) => {
        const amt = 5200 + Math.random() * 1500;
        addTxn(master, r, amt, new Date(t0.getTime() + idx * 45000), 1, 'fan_out', 'INSTANT_PAY');
      });
    }

    // Pattern 4: Structuring / Smurfing
    if (activePatternSet.has('structuring')) {
      const [s, r] = [getAcc(20), getAcc(21)];
      const t0 = getRandomTime();
      for (let k = 0; k < 6; k++) {
        const structAmt = 8800 + Math.random() * 950;
        addTxn(s, r, structAmt, new Date(t0.getTime() + k * 86400000), 1, 'structuring', 'WIRE');
      }
    }

    // Pattern 5: Multi-Hop Layered Shell Chains
    if (activePatternSet.has('layering_shells')) {
      const chain = [getAcc(22), getAcc(23), getAcc(24), getAcc(25), getAcc(26), getAcc(27)];
      const t0 = getRandomTime();
      const chainAmt = 35000.0 + round * 2500;
      for (let i = 0; i < chain.length - 1; i++) {
        addTxn(chain[i], chain[i + 1], chainAmt * (1 - i * 0.012), new Date(t0.getTime() + (i + 1) * 600000), 1, 'layering_shells', 'WIRE');
      }
    }

    // Pattern 6: Rapid Pass-Through Velocity
    if (activePatternSet.has('rapid_movement')) {
      const [feeder, mule, exit] = [getAcc(28), getAcc(29), getAcc(30)];
      const t0 = getRandomTime();
      const drainAmt = 24000.0;
      addTxn(feeder, mule, drainAmt, t0, 1, 'rapid_movement', 'WIRE');
      addTxn(mule, exit, drainAmt * 0.985, new Date(t0.getTime() + 30000), 1, 'rapid_movement', 'CRYPTO_BRIDGE');
    }

    // Pattern 7: High-Frequency Burst Activity
    if (activePatternSet.has('burst_activity')) {
      const s = getAcc(31);
      const t0 = getRandomTime();
      for (let b = 0; b < 10; b++) {
        const r = getAcc(32 + (b % 3));
        addTxn(s, r, 1200 + Math.random() * 800, new Date(t0.getTime() + b * 45000), 1, 'burst_activity', 'P2P');
      }
    }

    // Pattern 8: Night-Time Anomaly
    if (activePatternSet.has('night_activity')) {
      const [s, r] = [getAcc(35), getAcc(36)];
      for (let n = 0; n < 6; n++) {
        const tNight = getRandomTime(true);
        addTxn(s, r, 14500 + Math.random() * 5000, tNight, 1, 'night_activity', 'ONLINE');
      }
    }

    // Pattern 9: Scripted / Bot Periodic Transfers
    if (activePatternSet.has('periodic_transfers')) {
      const [bot1, bot2] = [getAcc(37), getAcc(38)];
      const t0 = getRandomTime();
      for (let p = 0; p < 8; p++) {
        addTxn(bot1, bot2, 3500.00, new Date(t0.getTime() + p * 60000), 1, 'periodic_transfers', 'API_BOT');
      }
    }

    // Pattern 10: Dormant Account Wake-Up
    if (activePatternSet.has('dormant_activation')) {
      const [dormant, target, receiver] = [getAcc(39), getAcc(40), getAcc(41)];
      const t0 = getRandomTime();
      addTxn(dormant, target, 55000.00, t0, 1, 'dormant_activation', 'WIRE');
      addTxn(target, receiver, 54000.00, new Date(t0.getTime() + 120000), 1, 'dormant_activation', 'WIRE');
    }

    // Pattern 11: Round Amount Spikes
    if (activePatternSet.has('round_amount_spikes')) {
      const [s, r] = [getAcc(42), getAcc(43)];
      const t0 = getRandomTime();
      [5000, 10000, 25000, 50000, 50000].forEach((val, i) => {
        addTxn(s, r, val, new Date(t0.getTime() + i * 3600000), 1, 'round_amount_spikes', 'ONLINE');
      });
    }

    // Pattern 12: Bipartite Bridge Clustering
    if (activePatternSet.has('bipartite_bridge')) {
      const clusterA = [getAcc(44), getAcc(45), getAcc(46)];
      const bridge = getAcc(47);
      const clusterB = [getAcc(48), getAcc(49), getAcc(50)];
      const t0 = getRandomTime();
      clusterA.forEach((a, i) => {
        addTxn(a, bridge, 8500 + Math.random() * 2000, new Date(t0.getTime() + i * 90000), 1, 'bipartite_bridge', 'WIRE');
      });
      clusterB.forEach((b, i) => {
        addTxn(bridge, b, 8200 + Math.random() * 2000, new Date(t0.getTime() + 400000 + i * 90000), 1, 'bipartite_bridge', 'WIRE');
      });
    }

    // Pattern 13: DC-LCG GNN Mule Embedding Ring
    if (activePatternSet.has('dclcg_gnn')) {
      const [m1, m2, m3, m4] = [getAcc(51), getAcc(52), getAcc(53), getAcc(54)];
      const t0 = getRandomTime();
      const gnnAmt = 21000.0;
      addTxn(m1, m2, gnnAmt, t0, 1, 'dclcg_gnn', 'WIRE');
      addTxn(m2, m3, gnnAmt * 0.97, new Date(t0.getTime() + 180000), 1, 'dclcg_gnn', 'WIRE');
      addTxn(m3, m4, gnnAmt * 0.95, new Date(t0.getTime() + 360000), 1, 'dclcg_gnn', 'WIRE');
      addTxn(m4, m1, gnnAmt * 0.92, new Date(t0.getTime() + 540000), 1, 'dclcg_gnn', 'WIRE');
    }

    // Pattern 14: Isolation Forest High-Dimensional Outlier
    if (activePatternSet.has('isolation_forest')) {
      const [s, r] = [getAcc(55), getAcc(56)];
      const t0 = getRandomTime(true);
      addTxn(s, r, 99500.00, t0, 1, 'isolation_forest', 'HIGH_VALUE_ESCROW');
    }

    // Pattern 15: Local Outlier Factor (LOF) Density Spike
    if (activePatternSet.has('lof_density')) {
      const hub = getAcc(57);
      const receivers = [getAcc(58), getAcc(59), getAcc(60), getAcc(61)];
      const t0 = getRandomTime();
      receivers.forEach((r, idx) => {
        addTxn(hub, r, 16500 + Math.random() * 2000, new Date(t0.getTime() + idx * 45000), 1, 'lof_density', 'ONLINE');
      });
    }

    // Pattern 16: DBSCAN Graph Noise Outlier
    if (activePatternSet.has('dbscan_noise')) {
      const [s, r] = [getAcc(62), getAcc(63)];
      const t0 = getRandomTime();
      addTxn(s, r, 48500.00, t0, 1, 'dbscan_noise', 'MERCHANT_GATEWAY');
    }

    // Pattern 17: Markovian Risk Propagation Diffusion
    if (activePatternSet.has('risk_propagation')) {
      const [seed, hop1, hop2, hop3] = [getAcc(64), getAcc(65), getAcc(66), getAcc(67)];
      const t0 = getRandomTime();
      addTxn(seed, hop1, 19000, t0, 1, 'risk_propagation', 'WIRE');
      addTxn(hop1, hop2, 18500, new Date(t0.getTime() + 120000), 1, 'risk_propagation', 'WIRE');
      addTxn(hop2, hop3, 18000, new Date(t0.getTime() + 240000), 1, 'risk_propagation', 'WIRE');
    }

    // Pattern 18: Dense Community Core Subgraph
    if (activePatternSet.has('community_mule_core')) {
      const [c1, c2, c3, c4] = [getAcc(68), getAcc(69), getAcc(70), getAcc(71)];
      const t0 = getRandomTime();
      addTxn(c1, c2, 11500, t0, 1, 'community_mule_core', 'P2P');
      addTxn(c2, c3, 11200, new Date(t0.getTime() + 90000), 1, 'community_mule_core', 'P2P');
      addTxn(c3, c4, 11000, new Date(t0.getTime() + 180000), 1, 'community_mule_core', 'P2P');
      addTxn(c4, c1, 10800, new Date(t0.getTime() + 270000), 1, 'community_mule_core', 'P2P');
      addTxn(c1, c3, 10500, new Date(t0.getTime() + 360000), 1, 'community_mule_core', 'P2P');
    }

    // Pattern 19: Temporal Cascade Storm
    if (activePatternSet.has('temporal_burst_cascade')) {
      const domino = [getAcc(72), getAcc(73), getAcc(74), getAcc(75), getAcc(76), getAcc(77), getAcc(78), getAcc(79), getAcc(80), getAcc(81)];
      const t0 = getRandomTime();
      const cascadeAmt = 26000.0;
      for (let d = 0; d < domino.length - 1; d++) {
        addTxn(domino[d], domino[d + 1], cascadeAmt * (1 - d * 0.012), new Date(t0.getTime() + d * 45000), 1, 'temporal_burst_cascade', 'INSTANT_SETTLEMENT');
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 2. FILL LEGITIMATE BACKGROUND TRANSACTIONS (to meet target count)
  // ────────────────────────────────────────────────────────────
  const channels = ['ONLINE', 'POS_RETAIL', 'MOBILE_P2P', 'SALARY_DIRECT', 'BILL_PAY', 'ECOMMERCE', 'ACH'];
  const fullAccountPool = accounts;

  while (transactions.length < numTransactions) {
    const s = fullAccountPool[Math.floor(Math.random() * fullAccountPool.length)];
    let r = fullAccountPool[Math.floor(Math.random() * fullAccountPool.length)];
    while (r === s && fullAccountPool.length > 1) {
      r = fullAccountPool[Math.floor(Math.random() * fullAccountPool.length)];
    }

    const t = getRandomTime(false);
    const amt = Number((minAmount + Math.random() * (maxAmount - minAmount) * 0.12).toFixed(2));
    const ch = channels[Math.floor(Math.random() * channels.length)];

    addTxn(s, r, amt, t, 0, null, ch);
  }

  // Sort chronologically by timestamp
  return transactions
    .slice(0, numTransactions)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Convert transaction objects array to CSV string.
 */
export function transactionsToCSV(transactions) {
  const header = 'sender_id,receiver_id,amount,timestamp,is_fraud,scenario_id,channel\n';
  const rows = transactions.map((t) =>
    `${t.sender_id},${t.receiver_id},${Number(t.amount).toFixed(2)},${t.timestamp},${t.is_fraud},${t.scenario_id || ''},${t.channel || 'ONLINE'}`
  ).join('\n');
  return header + rows;
}

/**
 * Generate a ready-to-upload File / Blob with minimum 10,000 transactions.
 */
export function generateClientDatasetFile({
  numTransactions = 10000,
  numAccounts = 650,
  fraudPercentage = 15,
  filename = 'auto_generated_client_transactions_10k.csv',
}) {
  const effectiveCount = Math.max(10000, numTransactions);
  const effectiveAccounts = Math.max(numAccounts, Math.floor(effectiveCount / 15));
  
  const txns = generateSyntheticTransactions({
    numTransactions: effectiveCount,
    numAccounts: effectiveAccounts,
    fraudPercentage,
    txnPrefix: 'TXN_CLIENT',
  });

  const csv = transactionsToCSV(txns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const file = new File([blob], filename, { type: 'text/csv' });
  return { file, txnsCount: txns.length, accountsCount: effectiveAccounts };
}

