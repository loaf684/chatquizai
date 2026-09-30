const {askOpenAI, sendError} = require('../lib/openai');

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
    const tip = await askOpenAI([
      {
        role:'system',
        content:'Berikan satu tips belajar yang singkat, maksimal dua kalimat, dalam bahasa Indonesia dengan nada suportif.'
      },
      {
        role:'user',
        content:`Mahasiswa mengerjakan kuis topik "${topic.trim()}" dan mendapat skor ${score} dari ${total}. Berikan tips belajar untuk membantunya memahami topik tersebut.`
      }
    ]);
    response.status(200).json({tip:tip.trim()});
  }catch(error){
    sendError(response, error);
  }
};
