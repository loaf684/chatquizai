const crypto = require('node:crypto');

const SHORT_WINDOW_MS = 10 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SHORT_LIMIT = 10;
const DAILY_LIMIT = 40;
const memoryBuckets = new Map();

function clientAddress(request){
  const headers = request.headers || {};
  const address = headers['x-real-ip'] ||
    request.ip ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    request.socket && request.socket.remoteAddress ||
    'unknown';
  return crypto.createHash('sha256').update(String(address)).digest('hex');
}

async function checkDistributedLimit(clientId, units, now){
  const shortBucket = Math.floor(now / SHORT_WINDOW_MS);
  const dayBucket = Math.floor(now / DAILY_WINDOW_MS);
  const shortKey = `quizbot:limit:${clientId}:10m:${shortBucket}`;
  const dayKey = `quizbot:limit:${clientId}:day:${dayBucket}`;
  const script = [
    "local short = redis.call('INCRBY', KEYS[1], ARGV[1])",
    "if short == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], ARGV[2]) end",
    "local daily = redis.call('INCRBY', KEYS[2], ARGV[1])",
    "if daily == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[2], ARGV[3]) end",
    "if short > tonumber(ARGV[4]) then return {0, redis.call('TTL', KEYS[1]), short, daily} end",
    "if daily > tonumber(ARGV[5]) then return {0, redis.call('TTL', KEYS[2]), short, daily} end",
    "return {1, 0, short, daily}"
  ].join('\n');

  let response;
  try{
    response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '')}/`, {
      method:'POST',
      headers:{
        Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify([
        'EVAL', script, '2', shortKey, dayKey,
        String(units),
        String(Math.ceil(SHORT_WINDOW_MS / 1000)),
        String(Math.ceil(DAILY_WINDOW_MS / 1000)),
        String(SHORT_LIMIT),
        String(DAILY_LIMIT)
      ])
    });
  }catch(error){
    const failure = new Error('Rate limit store tidak dapat dihubungi; permintaan AI dihentikan untuk keamanan.');
    failure.statusCode = 503;
    throw failure;
  }

  let result;
  try{
    result = await response.json();
  }catch{
    result = null;
  }
  if(!response.ok || !result || result.error || !Array.isArray(result.result)){
    const failure = new Error('Rate limit store gagal memproses permintaan; periksa konfigurasi Upstash.');
    failure.statusCode = 503;
    throw failure;
  }
  const [allowed, retryAfter] = result.result;
  return {allowed:Boolean(allowed), retryAfter:Math.max(1, Number(retryAfter) || 1), mode:'shared'};
}

function checkMemoryLimit(clientId, units, now){
  let bucket = memoryBuckets.get(clientId);
  if(!bucket){
    bucket = {
      shortStart:Math.floor(now / SHORT_WINDOW_MS) * SHORT_WINDOW_MS,
      shortCount:0,
      dailyStart:Math.floor(now / DAILY_WINDOW_MS) * DAILY_WINDOW_MS,
      dailyCount:0
    };
    memoryBuckets.set(clientId, bucket);
  }
  if(now - bucket.shortStart >= SHORT_WINDOW_MS){
    bucket.shortStart = Math.floor(now / SHORT_WINDOW_MS) * SHORT_WINDOW_MS;
    bucket.shortCount = 0;
  }
  if(now - bucket.dailyStart >= DAILY_WINDOW_MS){
    bucket.dailyStart = Math.floor(now / DAILY_WINDOW_MS) * DAILY_WINDOW_MS;
    bucket.dailyCount = 0;
  }
  bucket.shortCount += units;
  bucket.dailyCount += units;

  if(memoryBuckets.size > 10000){
    for(const [key, value] of memoryBuckets){
      if(now - value.dailyStart >= DAILY_WINDOW_MS) memoryBuckets.delete(key);
    }
  }

  if(bucket.shortCount > SHORT_LIMIT){
    return {
      allowed:false,
      retryAfter:Math.max(1, Math.ceil((bucket.shortStart + SHORT_WINDOW_MS - now) / 1000)),
      mode:'instance'
    };
  }
  if(bucket.dailyCount > DAILY_LIMIT){
    return {
      allowed:false,
      retryAfter:Math.max(1, Math.ceil((bucket.dailyStart + DAILY_WINDOW_MS - now) / 1000)),
      mode:'instance'
    };
  }
  return {allowed:true, retryAfter:0, mode:'instance'};
}

async function checkRateLimit(request, units = 1, now = Date.now()){
  if(!Number.isInteger(units) || units < 1 || units > SHORT_LIMIT){
    throw new TypeError('Rate limit units must be an integer between 1 and 10.');
  }
  const clientId = clientAddress(request);
  const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
  if(hasUrl !== hasToken){
    const error = new Error('UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN harus diatur bersama.');
    error.statusCode = 503;
    throw error;
  }
  const hasUpstash = hasUrl && hasToken;
  if(hasUpstash) return checkDistributedLimit(clientId, units, now);
  return checkMemoryLimit(clientId, units, now);
}

module.exports = {checkRateLimit, SHORT_LIMIT, DAILY_LIMIT};
