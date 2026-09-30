const {askGemini, sendError} = require('../lib/gemini');
const {checkRateLimit} = require('../lib/rate-limit');

module.exports = async (request, response)=>{
  if(request.method !== 'POST'){
    response.setHeader('Allow', 'POST');
    response.status(405).json({error:'Method tidak diizinkan.'});
    return;
  }
  const {topic, score, total} = request.body || {};
  if(
    typeof topic !== 'string' ||
    !topic.trim() ||
    topic.length > 120 ||
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    total < 1 ||
    score < 0 ||
    score > total
  ){
    response.status(400).json({error:'Data hasil kuis tidak valid.'});
    return;
  }

  try{
    const limit = await checkRateLimit(request);
    response.setHeader('X-RateLimit-Mode', limit.mode);
    if(!limit.allowed){
      response.setHeader('Retry-After', String(limit.retryAfter));
      response.status(429).json({
        error:`Batas penggunaan AI tercapai. Coba lagi dalam ${Math.ceil(limit.retryAfter / 60)} menit.`
      });
      return;
    }
    const tip = await askGemini(
      'Berikan satu tips belajar yang singkat, maksimal dua kalimat, dalam bahasa Indonesia dengan nada suportif.',
      `Mahasiswa mengerjakan kuis topik "${topic.trim()}" dan mendapat skor ${score} dari ${total}. Berikan tips belajar untuk membantunya memahami topik tersebut.`
    );
    response.status(200).json({tip:tip.trim()});
  }catch(error){
    sendError(response, error);
  }
};
