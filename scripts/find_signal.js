const fs = require('fs');
const dotenv = require('dotenv');
const { getHistoricalRates, Timeframe, Format } = require('dukascopy-node');
const os = require('os');
const path = require('path');

// Load environment variables
if (fs.existsSync('.env.production.local')) {
  dotenv.config({ path: '.env.production.local' });
} else if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config({ path: '.env' });
}

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const signalId = 61392;
  const sig = await prisma.cachedSignal.findFirst({
    where: {
      messageId: signalId
    }
  });

  console.log('CachedSignal for 61392 in DB:', JSON.stringify(sig, null, 2));

  const msg = await prisma.cachedMessage.findFirst({
    where: {
      messageId: signalId
    }
  });
  console.log('CachedMessage for 61392 in DB:', JSON.stringify(msg, null, 2));

  // Find any replies to 61392
  const replies = await prisma.cachedMessage.findMany({
    where: {
      replyToMsgId: signalId
    }
  });
  console.log('Replies to 61392:', JSON.stringify(replies, null, 2));

  if (sig) {
    console.log('\n--- Running Dukascopy Simulation for 61392 ---');
    const signalTime = new Date(sig.signalTime);
    console.log('Signal Time (parsed):', signalTime.toISOString(), 'Local:', signalTime.toString());
    console.log('Asset/Instr:', sig.asset, sig.instr);
    console.log('Action:', sig.action, 'Entry:', sig.entryClaimed, 'SL:', sig.sl, 'TPs:', sig.tps);
    console.log('Provider Claim Time:', sig.providerClaimTime ? new Date(sig.providerClaimTime).toISOString() : 'None');
    console.log('Provider Claim Msg:', sig.providerClaimMsg);

    const marketData = await getHistoricalRates({
      instrument: sig.instr || 'xauusd',
      dates: {
        from: signalTime,
        to: new Date(signalTime.getTime() + 24 * 60 * 60 * 1000),
      },
      timeframe: Timeframe.m1,
      format: Format.json,
      useCache: true,
      cacheFolderPath: path.join(os.tmpdir(), '.dukascopy-cache'),
    });

    console.log(`Fetched ${marketData ? marketData.length : 0} 1m candles from Dukascopy.`);

    if (marketData && marketData.length > 0) {
      console.log('First candle (entry):', marketData[0]);
      
      let marketResult = 'EXPIRED';
      let outcomeTime = null;
      let durationMinutes = null;
      let highest = -Infinity;
      let lowest = Infinity;
      let hitEvents = [];

      for (let i = 0; i < marketData.length; i++) {
        const candle = marketData[i];
        if (candle.high > highest) highest = candle.high;
        if (candle.low < lowest) lowest = candle.low;

        if (sig.action === 'SELL') {
          if (candle.high >= sig.sl && !outcomeTime) {
            marketResult = 'LOSS';
            outcomeTime = new Date(candle.timestamp).toISOString();
            durationMinutes = i + 1;
            hitEvents.push({ type: 'SL_HIT', candleIdx: i, time: outcomeTime, candle });
          }
          if (candle.low <= sig.tps[0] && !outcomeTime) {
            marketResult = 'WIN';
            outcomeTime = new Date(candle.timestamp).toISOString();
            durationMinutes = i + 1;
            hitEvents.push({ type: 'TP_HIT', candleIdx: i, time: outcomeTime, candle });
          }
        } else {
          // BUY
          if (candle.low <= sig.sl && !outcomeTime) {
            marketResult = 'LOSS';
            outcomeTime = new Date(candle.timestamp).toISOString();
            durationMinutes = i + 1;
            hitEvents.push({ type: 'SL_HIT', candleIdx: i, time: outcomeTime, candle });
          }
          if (candle.high >= sig.tps[0] && !outcomeTime) {
            marketResult = 'WIN';
            outcomeTime = new Date(candle.timestamp).toISOString();
            durationMinutes = i + 1;
            hitEvents.push({ type: 'TP_HIT', candleIdx: i, time: outcomeTime, candle });
          }
        }
      }

      console.log('\nSimulation result:', {
        marketResult,
        outcomeTime,
        durationMinutes,
        highest,
        lowest,
        hitEvents: hitEvents.slice(0, 5)
      });

      let fraudDetected = false;
      let marketPriceAtClaim = 'N/A';
      if (sig.providerClaimTime) {
        const claimTimeMs = new Date(sig.providerClaimTime).getTime();
        const candleAtClaim = marketData.find(c => Math.abs(c.timestamp - claimTimeMs) < 60000);
        if (candleAtClaim) marketPriceAtClaim = candleAtClaim.close;
        if (marketResult === 'LOSS') {
          fraudDetected = true;
        }
      }
      console.log('Claim analysis:', {
        providerClaimTime: sig.providerClaimTime,
        marketPriceAtClaim,
        fraudDetected
      });
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
