const {askGemini, sendError} = require('../lib/gemini');

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
    const tip = await askGemini(
      'Berikan satu tips belajar yang singkat, maksimal dua kalimat, dalam bahasa Indonesia dengan nada suportif.',
      `Mahasiswa mengerjakan kuis topik "${topic.trim()}" dan mendapat skor ${score} dari ${total}. Berikan tips belajar untuk membantunya memahami topik tersebut.`
    );
    response.status(200).json({tip:tip.trim()});
  }catch(error){
    sendError(response, error);
  }
};
